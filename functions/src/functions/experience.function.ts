import { onRequest } from "firebase-functions/v2/https"
import { HttpsError } from "firebase-functions/v2/https"
import { corsHandler } from "../config/cors"
import { RATE_LIMITS } from "../config/versions"
import { ExperienceService } from "../services/experience.service"
import { authMiddleware } from "../middleware/auth.middleware"
import { appCheckMiddleware } from "../middleware/app-check.middleware"
import { createRateLimitMiddleware } from "../middleware/rate-limit.middleware"
import { createDefaultLogger } from "../utils/logger"
import { createRequestId } from "../utils/request-id"
import type { ExperienceEntry } from "@jsdubzw/job-finder-shared-types"

const logger = createDefaultLogger()

export const createExperience = onRequest(
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

        const rateLimitMiddleware = createRateLimitMiddleware("experience", RATE_LIMITS.crud)
        await rateLimitMiddleware(request)

        if (request.method !== "POST") {
          throw new HttpsError("invalid-argument", "Method not allowed")
        }

        const body = request.body as Partial<ExperienceEntry>

        if (!body.companyName || !body.role || !body.startDate) {
          throw new HttpsError("invalid-argument", "companyName, role, and startDate are required")
        }

        const experienceService = new ExperienceService(authResult.user.uid, logger)
        const experience = await experienceService.create(body)

        logger.info("Experience created", {
          requestId,
          userId: authResult.user.uid,
          experienceId: experience.id,
        })

        response.status(201).json({
          success: true,
          data: experience,
        })
      })
    } catch (error) {
      logger.error("Create experience error", { error, requestId })

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

export const getExperience = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    maxInstances: 50,
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

        const experienceId = request.query.id as string
        if (!experienceId) {
          throw new HttpsError("invalid-argument", "Experience ID required")
        }

        const experienceService = new ExperienceService(authResult.user.uid, logger)
        const experience = await experienceService.get(experienceId)

        if (!experience) {
          throw new HttpsError("not-found", "Experience not found")
        }

        logger.info("Retrieved experience", {
          requestId,
          userId: authResult.user.uid,
          experienceId,
        })

        response.status(200).json({
          success: true,
          data: experience,
        })
      })
    } catch (error) {
      logger.error("Get experience error", { error, requestId })

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

export const listExperiences = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    maxInstances: 50,
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

        const experienceService = new ExperienceService(authResult.user.uid, logger)
        const experiences = await experienceService.list()

        logger.info("Listed experiences", {
          requestId,
          userId: authResult.user.uid,
          count: experiences.length,
        })

        response.status(200).json({
          success: true,
          data: experiences,
        })
      })
    } catch (error) {
      logger.error("List experiences error", { error, requestId })

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

export const updateExperience = onRequest(
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

        const rateLimitMiddleware = createRateLimitMiddleware("experience", RATE_LIMITS.crud)
        await rateLimitMiddleware(request)

        if (request.method !== "PUT" && request.method !== "PATCH") {
          throw new HttpsError("invalid-argument", "Method not allowed")
        }

        const experienceId = request.query.id as string
        if (!experienceId) {
          throw new HttpsError("invalid-argument", "Experience ID required")
        }

        const body = request.body as Partial<ExperienceEntry>

        const experienceService = new ExperienceService(authResult.user.uid, logger)
        const experience = await experienceService.update(experienceId, body)

        logger.info("Experience updated", {
          requestId,
          userId: authResult.user.uid,
          experienceId,
        })

        response.status(200).json({
          success: true,
          data: experience,
        })
      })
    } catch (error) {
      logger.error("Update experience error", { error, requestId })

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

export const deleteExperience = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
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

        const rateLimitMiddleware = createRateLimitMiddleware("experience", RATE_LIMITS.crud)
        await rateLimitMiddleware(request)

        if (request.method !== "DELETE") {
          throw new HttpsError("invalid-argument", "Method not allowed")
        }

        const experienceId = request.query.id as string
        if (!experienceId) {
          throw new HttpsError("invalid-argument", "Experience ID required")
        }

        const experienceService = new ExperienceService(authResult.user.uid, logger)
        await experienceService.delete(experienceId)

        logger.info("Experience deleted", {
          requestId,
          userId: authResult.user.uid,
          experienceId,
        })

        response.status(200).json({
          success: true,
          message: "Experience deleted successfully",
        })
      })
    } catch (error) {
      logger.error("Delete experience error", { error, requestId })

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
