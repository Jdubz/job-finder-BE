import { onRequest, HttpsError, type FunctionsErrorCode } from "firebase-functions/v2/https"
import type { Request, Response } from "express"
import { generatorCorsHandler } from "../config/cors"
import { createGeneratorService } from "../services/generator.service"
import { ExperienceService } from "../services/experience.service"
import { verifyAuth } from "../middleware/auth.middleware"
import { verifyAppCheck } from "../middleware/app-check.middleware"
import { generatorRateLimiter } from "../middleware/rate-limit.middleware"
import { createDefaultLogger } from "../utils/logger"
import { createRequestId } from "../utils/request-id"
import { runMiddleware } from "../utils/run-middleware"
import type {
  ExperienceEntry,
  GenerationType,
  JobInfo,
} from "@jsdubzw/job-finder-shared-types"

const logger = createDefaultLogger()

function mapHttpsErrorStatus(code: FunctionsErrorCode): number {
  switch (code) {
    case "invalid-argument":
    case "failed-precondition":
    case "out-of-range":
      return 400
    case "unauthenticated":
      return 401
    case "permission-denied":
      return 403
    case "not-found":
      return 404
    case "already-exists":
    case "aborted":
      return 409
    case "resource-exhausted":
      return 429
    case "unimplemented":
      return 501
    case "internal":
      return 500
    case "unavailable":
      return 503
    default:
      return 500
  }
}

async function prepareGeneratorRequest(
  req: Request,
  res: Response,
  { applyRateLimit = true }: { applyRateLimit?: boolean } = {}
): Promise<boolean> {
  await runMiddleware(req, res, generatorCorsHandler)
  if (res.headersSent) return false

  if (req.method === "OPTIONS") {
    res.status(204).send("")
    return false
  }

  await runMiddleware(req, res, verifyAuth)
  if (res.headersSent) return false

  await runMiddleware(req, res, verifyAppCheck)
  if (res.headersSent) return false

  if (applyRateLimit) {
    await runMiddleware(req, res, generatorRateLimiter)
    if (res.headersSent) return false
  }

  if (!req.user?.uid) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      },
    })
    return false
  }

  return true
}

function validateGenerateType(value: unknown): value is GenerationType {
  return value === "resume" || value === "coverLetter" || value === "both"
}

function validateJobPayload(job: Partial<JobInfo>): job is JobInfo {
  return typeof job.role === "string" && typeof job.company === "string"
}

async function loadExperiences(
  experienceIds: string[] | undefined,
  userId: string
): Promise<ExperienceEntry[]> {
  if (!experienceIds || experienceIds.length === 0) {
    return []
  }

  const experienceService = new ExperienceService(logger)
  const entries: ExperienceEntry[] = []

  for (const id of experienceIds) {
    try {
      const entry = await experienceService.getEntry(id, userId)
      if (entry) {
        entries.push(entry)
      } else {
        logger.warning("Experience entry not found or not accessible", {
          experienceId: id,
          userId,
        })
      }
    } catch (error) {
      logger.error("Failed to load experience entry", { error, experienceId: id, userId })
    }
  }

  return entries
}

function handleError(
  error: unknown,
  res: Response,
  context: { requestId: string; logMessage: string }
): void {
  logger.error(context.logMessage, { error, requestId: context.requestId })

  if (res.headersSent) {
    return
  }

  if (error instanceof HttpsError) {
    const status = mapHttpsErrorStatus(error.code)
    res.status(status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    })
    return
  }

  res.status(500).json({
    success: false,
    error: {
      code: "internal",
      message: "An unexpected error occurred",
    },
  })
}

export const generateDocument = onRequest(
  {
    region: "us-central1",
    memory: "2GiB",
    timeoutSeconds: 540,
    maxInstances: 10,
    cors: true,
  },
  async (request, response) => {
    const req = request as Request
    const res = response as Response
    const requestId = createRequestId()

    try {
      const prepared = await prepareGeneratorRequest(req, res)
      if (!prepared) {
        return
      }

      if (req.method !== "POST") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const body = req.body as {
        generateType?: GenerationType
        job?: Partial<JobInfo>
        experienceIds?: string[]
        jobMatchId?: string
        preferences?: {
          emphasize?: string[]
        }
      }

      if (!validateGenerateType(body.generateType)) {
        throw new HttpsError("invalid-argument", "Invalid generateType")
      }

      if (!body.job || !validateJobPayload(body.job)) {
        throw new HttpsError("invalid-argument", "Job role and company are required")
      }

      const userId = req.user?.uid as string
      const generatorService = createGeneratorService(logger)

      const personalInfo = await generatorService.getPersonalInfo(userId)
      if (!personalInfo) {
        throw new HttpsError(
          "failed-precondition",
          "Personal info not found. Please set up your profile first."
        )
      }

      if (!personalInfo.accentColor) {
        throw new HttpsError("failed-precondition", "Accent color required in personal info")
      }

      const experienceEntries = await loadExperiences(body.experienceIds, userId)

      const result = await generatorService.generateDocuments({
        generateType: body.generateType,
        job: body.job,
        personalInfo: personalInfo,
        experienceEntries,
        userId,
        jobMatchId: body.jobMatchId,
        preferences: body.preferences,
      })

      logger.info("Document generation completed", {
        requestId,
        userId,
        generateType: body.generateType,
        generatorRequestId: result.requestId,
      })

      res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "Generator function error",
      })
    }
  }
)

export const getGenerationRequest = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 60,
    maxInstances: 20,
    cors: true,
  },
  async (request, response) => {
    const req = request as Request
    const res = response as Response
    const requestId = createRequestId()

    try {
      const prepared = await prepareGeneratorRequest(req, res, { applyRateLimit: false })
      if (!prepared) {
        return
      }

      if (req.method !== "GET") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const generatorRequestId = req.query.requestId as string | undefined
      if (!generatorRequestId) {
        throw new HttpsError("invalid-argument", "requestId required")
      }

      const userId = req.user?.uid as string
      const generatorService = createGeneratorService(logger)
      const generatorRequest = await generatorService.getRequest(generatorRequestId)

      if (!generatorRequest) {
        throw new HttpsError("not-found", "Request not found")
      }

      if (generatorRequest.access.userId !== userId) {
        throw new HttpsError("permission-denied", "Access denied")
      }

      logger.info("Retrieved generation request", {
        requestId,
        userId,
        generatorRequestId,
      })

      res.status(200).json({
        success: true,
        data: generatorRequest,
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "Get generation request error",
      })
    }
  }
)

export const getGenerationResponse = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 60,
    maxInstances: 20,
    cors: true,
  },
  async (request, response) => {
    const req = request as Request
    const res = response as Response
    const requestId = createRequestId()

    try {
      const prepared = await prepareGeneratorRequest(req, res, { applyRateLimit: false })
      if (!prepared) {
        return
      }

      if (req.method !== "GET") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const responseId = req.query.responseId as string | undefined
      if (!responseId) {
        throw new HttpsError("invalid-argument", "responseId required")
      }

      const userId = req.user?.uid as string
      const generatorService = createGeneratorService(logger)
      const generatorResponse = await generatorService.getResponse(responseId)

      if (!generatorResponse) {
        throw new HttpsError("not-found", "Response not found")
      }

      const requestIdFromResponse = generatorResponse.requestId
      const generatorRequest = await generatorService.getRequest(requestIdFromResponse)

      if (!generatorRequest || generatorRequest.access.userId !== userId) {
        throw new HttpsError("permission-denied", "Access denied")
      }

      logger.info("Retrieved generation response", {
        requestId,
        userId,
        responseId,
      })

      res.status(200).json({
        success: true,
        data: generatorResponse,
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "Get generation response error",
      })
    }
  }
)
