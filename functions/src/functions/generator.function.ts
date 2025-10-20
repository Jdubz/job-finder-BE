import { onRequest } from "firebase-functions/v2/https"
import { HttpsError } from "firebase-functions/v2/https"
import { corsHandler } from "../config/cors"
import { RATE_LIMITS } from "../config/versions"
import { createGeneratorService } from "../services/generator.service"
import { authMiddleware } from "../middleware/auth.middleware"
import { appCheckMiddleware } from "../middleware/app-check.middleware"
import { createRateLimitMiddleware } from "../middleware/rate-limit.middleware"
import { createDefaultLogger } from "../utils/logger"
import { createRequestId } from "../utils/request-id"
import type { GenerationType } from "@jsdubzw/job-finder-shared-types"

const logger = createDefaultLogger()

export const generateDocument = onRequest(
  {
    region: "us-central1",
    memory: "2GiB",
    timeoutSeconds: 540,
    maxInstances: 10,
    cors: true,
  },
  async (request, response) => {
    const requestId = createRequestId()

    try {
      await corsHandler(request, response, async () => {
        const authResult = await authMiddleware(request, response)
        if (!authResult.success || !authResult.user) {
          throw new HttpsError("unauthenticated", "Authentication required")
        }

        await appCheckMiddleware(request)

        const rateLimitMiddleware = createRateLimitMiddleware("generator", RATE_LIMITS.generator)
        await rateLimitMiddleware(request)

        if (request.method !== "POST") {
          throw new HttpsError("invalid-argument", "Method not allowed")
        }

        const body = request.body as {
          generateType?: GenerationType
          job?: unknown
          experienceIds?: string[]
          jobMatchId?: string
          preferences?: {
            emphasize?: string[]
          }
        }

        if (!body.generateType || !["resume", "coverLetter", "both"].includes(body.generateType)) {
          throw new HttpsError("invalid-argument", "Invalid generateType")
        }

        if (!body.job || typeof body.job !== "object") {
          throw new HttpsError("invalid-argument", "Job information required")
        }

        const generatorService = createGeneratorService(logger)

        const personalInfo = await generatorService.getPersonalInfo(authResult.user.uid)
        if (!personalInfo) {
          throw new HttpsError("failed-precondition", "Personal info not found. Please set up your profile first.")
        }

        if (!personalInfo.accentColor) {
          throw new HttpsError("failed-precondition", "Accent color required in personal info")
        }

        let experienceEntries = []
        if (body.experienceIds && body.experienceIds.length > 0) {
          const { ExperienceService } = await import("../services/experience.service")
          const experienceService = new ExperienceService(authResult.user.uid, logger)

          for (const experienceId of body.experienceIds) {
            const experience = await experienceService.get(experienceId)
            if (experience) {
              experienceEntries.push(experience)
            }
          }
        }

        const result = await generatorService.generateDocuments({
          generateType: body.generateType,
          job: body.job as any,
          personalInfo: personalInfo as any,
          experienceEntries,
          userId: authResult.user.uid,
          jobMatchId: body.jobMatchId,
          preferences: body.preferences,
        })

        logger.info("Document generation completed", {
          requestId,
          userId: authResult.user.uid,
          generateType: body.generateType,
          generatorRequestId: result.requestId,
        })

        response.status(200).json({
          success: true,
          data: result,
        })
      })
    } catch (error) {
      logger.error("Generator function error", { error, requestId })

      if (error instanceof HttpsError) {
        response.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        })
      } else {
        response.status(500).json({
          success: false,
          error: {
            code: "internal",
            message: "An unexpected error occurred",
          },
        })
      }
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
    const requestId = createRequestId()

    try {
      await corsHandler(request, response, async () => {
        const authResult = await authMiddleware(request, response)
        if (!authResult.success || !authResult.user) {
          throw new HttpsError("unauthenticated", "Authentication required")
        }

        await appCheckMiddleware(request)

        if (request.method !== "GET") {
          throw new HttpsError("invalid-argument", "Method not allowed")
        }

        const generatorRequestId = request.query.requestId as string
        if (!generatorRequestId) {
          throw new HttpsError("invalid-argument", "requestId required")
        }

        const generatorService = createGeneratorService(logger)
        const generatorRequest = await generatorService.getRequest(generatorRequestId)

        if (!generatorRequest) {
          throw new HttpsError("not-found", "Request not found")
        }

        if (generatorRequest.access.userId !== authResult.user.uid) {
          throw new HttpsError("permission-denied", "Access denied")
        }

        logger.info("Retrieved generation request", {
          requestId,
          userId: authResult.user.uid,
          generatorRequestId,
        })

        response.status(200).json({
          success: true,
          data: generatorRequest,
        })
      })
    } catch (error) {
      logger.error("Get generation request error", { error, requestId })

      if (error instanceof HttpsError) {
        response.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        })
      } else {
        response.status(500).json({
          success: false,
          error: {
            code: "internal",
            message: "An unexpected error occurred",
          },
        })
      }
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
    const requestId = createRequestId()

    try {
      await corsHandler(request, response, async () => {
        const authResult = await authMiddleware(request, response)
        if (!authResult.success || !authResult.user) {
          throw new HttpsError("unauthenticated", "Authentication required")
        }

        await appCheckMiddleware(request)

        if (request.method !== "GET") {
          throw new HttpsError("invalid-argument", "Method not allowed")
        }

        const responseId = request.query.responseId as string
        if (!responseId) {
          throw new HttpsError("invalid-argument", "responseId required")
        }

        const generatorService = createGeneratorService(logger)
        const generatorResponse = await generatorService.getResponse(responseId)

        if (!generatorResponse) {
          throw new HttpsError("not-found", "Response not found")
        }

        const requestIdFromResponse = generatorResponse.requestId
        const generatorRequest = await generatorService.getRequest(requestIdFromResponse)

        if (!generatorRequest || generatorRequest.access.userId !== authResult.user.uid) {
          throw new HttpsError("permission-denied", "Access denied")
        }

        logger.info("Retrieved generation response", {
          requestId,
          userId: authResult.user.uid,
          responseId,
        })

        response.status(200).json({
          success: true,
          data: generatorResponse,
        })
      })
    } catch (error) {
      logger.error("Get generation response error", { error, requestId })

      if (error instanceof HttpsError) {
        response.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        })
      } else {
        response.status(500).json({
          success: false,
          error: {
            code: "internal",
            message: "An unexpected error occurred",
          },
        })
      }
    }
  }
)
