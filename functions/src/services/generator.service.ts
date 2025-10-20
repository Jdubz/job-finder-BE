import { FieldValue } from "@google-cloud/firestore"
import type { SimpleLogger } from "../types/logger.types"
import { createDefaultLogger } from "../utils/logger"
import { createFirestoreInstance } from "../config/firestore"
import { GENERATOR_DOCUMENTS_COLLECTION } from "../config/database"
import { SecretManagerService } from "./secret-manager.service"
import { OpenAIService } from "./openai.service"
import { PDFService } from "./pdf.service"
import { StorageService } from "./storage.service"
import type {
  PersonalInfo,
  JobInfo,
  ExperienceEntry,
  ResumeContent,
  CoverLetterContent,
  GeneratorRequest,
  GeneratorResponse,
  GenerationType,
  GenerationStep,
  TokenUsage,
} from "@jsdubzw/job-finder-shared-types"

const PERSONAL_INFO_DOC_ID = "personal-info"

export interface GenerateDocumentsOptions {
  generateType: GenerationType
  job: JobInfo
  personalInfo: PersonalInfo & { accentColor: string }
  experienceEntries: ExperienceEntry[]
  userId: string
  jobMatchId?: string
  preferences?: {
    emphasize?: string[]
  }
}

export class GeneratorService {
  private db: FirebaseFirestore.Firestore
  private logger: SimpleLogger
  private collectionName: string
  private secretManager: SecretManagerService
  private pdfService: PDFService
  private storageService: StorageService

  constructor(logger?: SimpleLogger) {
    this.collectionName = GENERATOR_DOCUMENTS_COLLECTION
    this.db = createFirestoreInstance()
    this.logger = logger || createDefaultLogger()
    this.secretManager = new SecretManagerService()
    this.pdfService = new PDFService(logger)
    this.storageService = new StorageService(undefined, logger)
  }

  async getPersonalInfo(userId: string): Promise<(PersonalInfo & { id: string }) | null> {
    try {
      const docRef = this.db
        .collection(this.collectionName)
        .doc(userId)
        .collection("personal-info")
        .doc(PERSONAL_INFO_DOC_ID)

      const doc = await docRef.get()

      if (!doc.exists) {
        this.logger.info("Personal info not found", { userId })
        return null
      }

      const data = doc.data()
      return { id: doc.id, ...data } as PersonalInfo & { id: string }
    } catch (error) {
      this.logger.error("Failed to get personal info", { error, userId })
      throw error
    }
  }

  async updatePersonalInfo(
    userId: string,
    data: Partial<Omit<PersonalInfo, "id">>
  ): Promise<PersonalInfo & { id: string }> {
    try {
      const docRef = this.db
        .collection(this.collectionName)
        .doc(userId)
        .collection("personal-info")
        .doc(PERSONAL_INFO_DOC_ID)

      const doc = await docRef.get()

      if (!doc.exists) {
        const newData = {
          id: PERSONAL_INFO_DOC_ID,
          userId,
          ...data,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
        await docRef.set(newData)
      } else {
        await docRef.update({
          ...data,
          updatedAt: FieldValue.serverTimestamp(),
        })
      }

      const updatedDoc = await docRef.get()
      const updatedData = updatedDoc.data()
      return { id: updatedDoc.id, ...updatedData } as PersonalInfo & { id: string }
    } catch (error) {
      this.logger.error("Failed to update personal info", { error, userId })
      throw error
    }
  }

  async createRequest(options: GenerateDocumentsOptions): Promise<string> {
    try {
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).slice(2, 11)
      const requestId = `job-finder-generator-request-${timestamp}-${randomId}`

      const request: Omit<GeneratorRequest, "createdAt"> = {
        id: requestId,
        type: "request",
        generateType: options.generateType,
        provider: "openai",
        personalInfo: options.personalInfo,
        job: options.job,
        experienceData: {
          entries: options.experienceEntries,
        },
        status: "pending",
        access: {
          userId: options.userId,
          isPublic: false,
        },
        createdBy: options.userId,
        ...(options.jobMatchId && { jobMatchId: options.jobMatchId }),
        ...(options.preferences && { preferences: options.preferences }),
      }

      await this.db
        .collection(this.collectionName)
        .doc(requestId)
        .set({
          ...request,
          createdAt: FieldValue.serverTimestamp(),
        })

      this.logger.info("Created generation request", {
        requestId,
        generateType: options.generateType,
        userId: options.userId,
      })

      return requestId
    } catch (error) {
      this.logger.error("Failed to create generation request", { error })
      throw error
    }
  }

  async getRequest(requestId: string): Promise<GeneratorRequest | null> {
    try {
      const doc = await this.db.collection(this.collectionName).doc(requestId).get()
      if (!doc.exists) return null
      const data = doc.data()
      return { id: doc.id, ...data } as GeneratorRequest
    } catch (error) {
      this.logger.error("Failed to get generation request", { error, requestId })
      throw error
    }
  }

  async updateStatus(requestId: string, status: GeneratorRequest["status"]): Promise<void> {
    try {
      await this.db
        .collection(this.collectionName)
        .doc(requestId)
        .update({
          status,
          updatedAt: FieldValue.serverTimestamp(),
        })
    } catch (error) {
      this.logger.error("Failed to update status", { error, requestId })
      throw error
    }
  }

  async updateSteps(requestId: string, steps: GenerationStep[]): Promise<void> {
    try {
      await this.db
        .collection(this.collectionName)
        .doc(requestId)
        .update({
          steps,
          updatedAt: FieldValue.serverTimestamp(),
        })

      await new Promise((resolve) => setTimeout(resolve, 300))
    } catch (error) {
      this.logger.error("Failed to update steps", { error, requestId })
      throw error
    }
  }

  async updateIntermediateResults(
    requestId: string,
    results: {
      resumeContent?: ResumeContent
      coverLetterContent?: CoverLetterContent
      resumeTokenUsage?: TokenUsage
      coverLetterTokenUsage?: TokenUsage
      model?: string
    }
  ): Promise<void> {
    try {
      const updates: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      }

      if (results.resumeContent) updates["intermediateResults.resumeContent"] = results.resumeContent
      if (results.coverLetterContent)
        updates["intermediateResults.coverLetterContent"] = results.coverLetterContent
      if (results.resumeTokenUsage)
        updates["intermediateResults.resumeTokenUsage"] = results.resumeTokenUsage
      if (results.coverLetterTokenUsage)
        updates["intermediateResults.coverLetterTokenUsage"] = results.coverLetterTokenUsage
      if (results.model) updates["intermediateResults.model"] = results.model

      await this.db.collection(this.collectionName).doc(requestId).update(updates)
    } catch (error) {
      this.logger.error("Failed to update intermediate results", { error, requestId })
      throw error
    }
  }

  async createResponse(
    requestId: string,
    result: GeneratorResponse["result"],
    metrics: GeneratorResponse["metrics"],
    files?: GeneratorResponse["files"]
  ): Promise<string> {
    try {
      const responseId = requestId.replace("request", "response")

      const response: Omit<GeneratorResponse, "createdAt"> = {
        id: responseId,
        type: "response",
        requestId,
        result,
        metrics,
        ...(files && { files }),
      }

      await this.db
        .collection(this.collectionName)
        .doc(responseId)
        .set({
          ...response,
          createdAt: FieldValue.serverTimestamp(),
        })

      this.logger.info("Created generation response", {
        responseId,
        success: result.success,
      })

      return responseId
    } catch (error) {
      this.logger.error("Failed to create response", { error, requestId })
      throw error
    }
  }

  async getResponse(responseId: string): Promise<GeneratorResponse | null> {
    try {
      const doc = await this.db.collection(this.collectionName).doc(responseId).get()
      if (!doc.exists) return null
      const data = doc.data()
      return { id: doc.id, ...data } as GeneratorResponse
    } catch (error) {
      this.logger.error("Failed to get response", { error, responseId })
      throw error
    }
  }

  async getRequestWithResponse(requestId: string): Promise<{
    request: GeneratorRequest
    response: GeneratorResponse
  } | null> {
    try {
      const responseId = requestId.replace("request", "response")
      const [requestDoc, responseDoc] = await Promise.all([
        this.db.collection(this.collectionName).doc(requestId).get(),
        this.db.collection(this.collectionName).doc(responseId).get(),
      ])

      if (!requestDoc.exists || !responseDoc.exists) return null

      const requestData = requestDoc.data()
      const responseData = responseDoc.data()

      return {
        request: { id: requestDoc.id, ...requestData } as GeneratorRequest,
        response: { id: responseDoc.id, ...responseData } as GeneratorResponse,
      }
    } catch (error) {
      this.logger.error("Failed to get request with response", { error, requestId })
      throw error
    }
  }

  async listRequests(
    userId: string,
    options?: { limit?: number }
  ): Promise<GeneratorRequest[]> {
    try {
      let query = this.db
        .collection(this.collectionName)
        .where("type", "==", "request")
        .where("access.userId", "==", userId)
        .orderBy("createdAt", "desc") as FirebaseFirestore.Query

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const snapshot = await query.get()
      return snapshot.docs.map((doc) => {
        const data = doc.data()
        return { id: doc.id, ...data } as GeneratorRequest
      })
    } catch (error) {
      this.logger.error("Failed to list requests", { error, userId })
      throw error
    }
  }

  async generateDocuments(options: GenerateDocumentsOptions): Promise<{
    requestId: string
    responseId: string
    resumeUrl?: string
    coverLetterUrl?: string
  }> {
    const startTime = Date.now()
    let requestId: string | null = null

    try {
      requestId = await this.createRequest(options)

      const steps: GenerationStep[] = [
        {
          id: "create-request",
          name: "Create Request",
          description: "Request created successfully",
          status: "completed",
        },
        {
          id: "generate-content",
          name: "Generate AI Content",
          description: "Generating resume and cover letter content with OpenAI",
          status: "in_progress",
        },
        {
          id: "create-pdfs",
          name: "Create PDFs",
          description: "Rendering PDF documents from generated content",
          status: "pending",
        },
        {
          id: "upload-storage",
          name: "Upload to Storage",
          description: "Uploading PDFs to Google Cloud Storage",
          status: "pending",
        },
      ]

      await this.updateSteps(requestId, steps)
      await this.updateStatus(requestId, "processing")

      const apiKey = await this.secretManager.getSecret("OPENAI_API_KEY")
      const openaiService = new OpenAIService(apiKey, this.logger)

      const generateResume = options.generateType === "resume" || options.generateType === "both"
      const generateCoverLetter =
        options.generateType === "coverLetter" || options.generateType === "both"

      let resumeContent: ResumeContent | undefined
      let coverLetterContent: CoverLetterContent | undefined
      let totalTokenUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

      if (generateResume) {
        const resumeResult = await openaiService.generateResume({
          personalInfo: options.personalInfo,
          job: options.job,
          experienceEntries: options.experienceEntries,
          emphasize: options.preferences?.emphasize,
        })

        resumeContent = resumeResult.content
        totalTokenUsage.promptTokens += resumeResult.tokenUsage.promptTokens
        totalTokenUsage.completionTokens += resumeResult.tokenUsage.completionTokens
        totalTokenUsage.totalTokens += resumeResult.tokenUsage.totalTokens

        await this.updateIntermediateResults(requestId, {
          resumeContent,
          resumeTokenUsage: resumeResult.tokenUsage,
          model: resumeResult.model,
        })
      }

      if (generateCoverLetter) {
        const coverLetterResult = await openaiService.generateCoverLetter({
          personalInfo: options.personalInfo,
          job: options.job,
          experienceEntries: options.experienceEntries,
        })

        coverLetterContent = coverLetterResult.content
        totalTokenUsage.promptTokens += coverLetterResult.tokenUsage.promptTokens
        totalTokenUsage.completionTokens += coverLetterResult.tokenUsage.completionTokens
        totalTokenUsage.totalTokens += coverLetterResult.tokenUsage.totalTokens

        await this.updateIntermediateResults(requestId, {
          coverLetterContent,
          coverLetterTokenUsage: coverLetterResult.tokenUsage,
          model: coverLetterResult.model,
        })
      }

      steps[1].status = "completed"
      steps[2].status = "in_progress"
      await this.updateSteps(requestId, steps)

      let resumePdfBuffer: Buffer | undefined
      let coverLetterPdfBuffer: Buffer | undefined

      if (resumeContent) {
        resumePdfBuffer = await this.pdfService.generateResumePDF(resumeContent)
      }

      if (coverLetterContent) {
        const today = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        coverLetterPdfBuffer = await this.pdfService.generateCoverLetterPDF(
          coverLetterContent,
          options.personalInfo.name,
          options.personalInfo.email,
          options.personalInfo.accentColor,
          today
        )
      }

      steps[2].status = "completed"
      steps[3].status = "in_progress"
      await this.updateSteps(requestId, steps)

      let resumeUrl: string | undefined
      let coverLetterUrl: string | undefined
      const uploadedFiles: GeneratorResponse["files"] = {}

      if (resumePdfBuffer && resumeContent) {
        const filename = `${options.personalInfo.name.replace(/\s+/g, "-")}-${options.job.company.replace(/\s+/g, "-")}-resume.pdf`
        const uploadResult = await this.storageService.uploadPDF(resumePdfBuffer, filename, "resume")
        resumeUrl = await this.storageService.generatePublicUrl(uploadResult.gcsPath)

        uploadedFiles.resume = {
          gcsPath: uploadResult.gcsPath,
          size: uploadResult.size,
          storageClass: uploadResult.storageClass,
        }
      }

      if (coverLetterPdfBuffer && coverLetterContent) {
        const filename = `${options.personalInfo.name.replace(/\s+/g, "-")}-${options.job.company.replace(/\s+/g, "-")}-cover-letter.pdf`
        const uploadResult = await this.storageService.uploadPDF(
          coverLetterPdfBuffer,
          filename,
          "cover-letter"
        )
        coverLetterUrl = await this.storageService.generatePublicUrl(uploadResult.gcsPath)

        uploadedFiles.coverLetter = {
          gcsPath: uploadResult.gcsPath,
          size: uploadResult.size,
          storageClass: uploadResult.storageClass,
        }
      }

      steps[3].status = "completed"
      await this.updateSteps(requestId, steps)
      await this.updateStatus(requestId, "completed")

      const durationMs = Date.now() - startTime
      const cost = openaiService.calculateCost(totalTokenUsage)

      const responseId = await this.createResponse(
        requestId,
        {
          success: true,
          ...(resumeContent && { resume: resumeContent }),
          ...(coverLetterContent && { coverLetter: coverLetterContent }),
        },
        {
          durationMs,
          tokenUsage: {
            resumePrompt: generateResume ? totalTokenUsage.promptTokens : undefined,
            resumeCompletion: generateResume ? totalTokenUsage.completionTokens : undefined,
            coverLetterPrompt: generateCoverLetter ? totalTokenUsage.promptTokens : undefined,
            coverLetterCompletion: generateCoverLetter
              ? totalTokenUsage.completionTokens
              : undefined,
            total: totalTokenUsage.totalTokens,
          },
          costUsd: cost,
          model: openaiService.model,
        },
        Object.keys(uploadedFiles).length > 0 ? uploadedFiles : undefined
      )

      return {
        requestId,
        responseId,
        resumeUrl,
        coverLetterUrl,
      }
    } catch (error) {
      this.logger.error("Document generation failed", { error, requestId })

      if (requestId) {
        await this.updateStatus(requestId, "failed")

        const durationMs = Date.now() - startTime
        const responseId = await this.createResponse(
          requestId,
          {
            success: false,
            error: {
              message: error instanceof Error ? error.message : String(error),
              code: "GENERATION_ERROR",
            },
          },
          {
            durationMs,
            model: "gpt-4o-2024-08-06",
          }
        )

        return { requestId, responseId }
      }

      throw error
    }
  }
}

export function createGeneratorService(logger?: SimpleLogger): GeneratorService {
  return new GeneratorService(logger)
}
