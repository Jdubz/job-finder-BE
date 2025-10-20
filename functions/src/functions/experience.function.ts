import { onRequest, HttpsError, type FunctionsErrorCode } from "firebase-functions/v2/https"
import type { Request, Response } from "express"
import { corsHandler } from "../config/cors"
import { ExperienceService, type CreateExperienceData, type UpdateExperienceData } from "../services/experience.service"
import { verifyAuth } from "../middleware/auth.middleware"
import { verifyAppCheck } from "../middleware/app-check.middleware"
import { contentItemsRateLimiter } from "../middleware/rate-limit.middleware"
import { createDefaultLogger } from "../utils/logger"
import { createRequestId } from "../utils/request-id"
import { runMiddleware } from "../utils/run-middleware"
import type { ExperienceEntry } from "@jsdubzw/job-finder-shared-types"

const logger = createDefaultLogger()
const DATE_REGEX = /^\d{4}-\d{2}$/

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

async function prepareExperienceRequest(
  req: Request,
  res: Response,
  { applyRateLimit = true }: { applyRateLimit?: boolean } = {}
): Promise<string | null> {
  await runMiddleware(req, res, corsHandler)
  if (res.headersSent) return null

  if (req.method === "OPTIONS") {
    res.status(204).send("")
    return null
  }

  await runMiddleware(req, res, verifyAuth)
  if (res.headersSent) return null

  await runMiddleware(req, res, verifyAppCheck)
  if (res.headersSent) return null

  if (applyRateLimit) {
    await runMiddleware(req, res, contentItemsRateLimiter)
    if (res.headersSent) return null
  }

  const userId = req.user?.uid
  if (!userId) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      },
    })
    return null
  }

  return userId
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

function toHttpsError(error: unknown, fallbackMessage: string): HttpsError {
  if (error instanceof HttpsError) {
    return error
  }

  if (error instanceof Error) {
    const message = error.message || fallbackMessage
    const normalized = message.toLowerCase()

    if (normalized.includes("permission")) {
      return new HttpsError("permission-denied", message)
    }

    if (normalized.includes("not found")) {
      return new HttpsError("not-found", message)
    }

    if (normalized.includes("missing") || normalized.includes("invalid") || normalized.includes("required")) {
      return new HttpsError("invalid-argument", message)
    }

    return new HttpsError("internal", message)
  }

  return new HttpsError("internal", fallbackMessage)
}

function validateDates(data: { startDate?: string; endDate?: string | null }): void {
  if (data.startDate && !DATE_REGEX.test(data.startDate)) {
    throw new HttpsError("invalid-argument", "startDate must be in YYYY-MM format")
  }
  if (data.endDate && data.endDate !== null && !DATE_REGEX.test(data.endDate)) {
    throw new HttpsError("invalid-argument", "endDate must be in YYYY-MM format")
  }
}

function buildCreatePayload(body: Partial<ExperienceEntry>): CreateExperienceData {
  if (typeof body.company !== "string" || body.company.trim().length === 0) {
    throw new HttpsError("invalid-argument", "company must be a non-empty string")
  }

  if (typeof body.role !== "string" || body.role.trim().length === 0) {
    throw new HttpsError("invalid-argument", "role must be a non-empty string")
  }

  if (typeof body.startDate !== "string" || body.startDate.trim().length === 0) {
    throw new HttpsError("invalid-argument", "startDate must be provided")
  }

  const highlights = Array.isArray(body.highlights)
    ? body.highlights.every((item) => typeof item === "string")
      ? body.highlights
      : (() => {
          throw new HttpsError("invalid-argument", "highlights must be an array of strings")
        })()
    : []

  const technologies = Array.isArray(body.technologies)
    ? body.technologies.every((item) => typeof item === "string")
      ? body.technologies
      : (() => {
          throw new HttpsError("invalid-argument", "technologies must be an array of strings")
        })()
    : []

  return {
    company: body.company,
    role: body.role,
    location: typeof body.location === "string" ? body.location : undefined,
    startDate: body.startDate,
    endDate:
      body.endDate === undefined
        ? null
        : typeof body.endDate === "string"
          ? body.endDate
          : null,
    highlights,
    technologies,
  }
}

function buildUpdatePayload(body: Partial<ExperienceEntry>): UpdateExperienceData {
  const payload: UpdateExperienceData = {}

  if (body.company !== undefined) {
    if (typeof body.company !== "string" || body.company.trim().length === 0) {
      throw new HttpsError("invalid-argument", "company must be a non-empty string")
    }
    payload.company = body.company
  }

  if (body.role !== undefined) {
    if (typeof body.role !== "string" || body.role.trim().length === 0) {
      throw new HttpsError("invalid-argument", "role must be a non-empty string")
    }
    payload.role = body.role
  }

  if (body.location !== undefined) {
    if (body.location !== null && typeof body.location !== "string") {
      throw new HttpsError("invalid-argument", "location must be a string")
    }
    payload.location = body.location ?? undefined
  }

  if (body.startDate !== undefined) {
    if (typeof body.startDate !== "string") {
      throw new HttpsError("invalid-argument", "startDate must be a string")
    }
    payload.startDate = body.startDate
  }

  if (body.endDate !== undefined) {
    if (body.endDate !== null && typeof body.endDate !== "string") {
      throw new HttpsError("invalid-argument", "endDate must be a string or null")
    }
    payload.endDate = body.endDate ?? null
  }

  if (body.highlights !== undefined) {
    if (!Array.isArray(body.highlights) || body.highlights.some((item) => typeof item !== "string")) {
      throw new HttpsError("invalid-argument", "highlights must be an array of strings")
    }
    payload.highlights = body.highlights
  }

  if (body.technologies !== undefined) {
    if (!Array.isArray(body.technologies) || body.technologies.some((item) => typeof item !== "string")) {
      throw new HttpsError("invalid-argument", "technologies must be an array of strings")
    }
    payload.technologies = body.technologies
  }

  return payload
}

export const createExperience = onRequest(
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
      const userId = await prepareExperienceRequest(req, res)
      if (!userId) {
        return
      }

      if (req.method !== "POST") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const body = req.body as Partial<ExperienceEntry>

      if (!body.company || !body.role || !body.startDate) {
        throw new HttpsError("invalid-argument", "company, role, and startDate are required")
      }

      validateDates({ startDate: body.startDate, endDate: body.endDate as string | null })

      const experienceService = new ExperienceService(logger)

      let experience: ExperienceEntry
      try {
        experience = await experienceService.createEntry(
          buildCreatePayload(body),
          userId
        )
      } catch (serviceError) {
        throw toHttpsError(serviceError, "Failed to create experience entry")
      }

      logger.info("Experience created", {
        requestId,
        userId,
        experienceId: experience.id,
      })

      res.status(201).json({
        success: true,
        data: experience,
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "Create experience error",
      })
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
    const req = request as Request
    const res = response as Response
    const requestId = createRequestId()

    try {
      const userId = await prepareExperienceRequest(req, res, { applyRateLimit: false })
      if (!userId) {
        return
      }

      if (req.method !== "GET") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const experienceId = req.query.id as string | undefined
      if (!experienceId) {
        throw new HttpsError("invalid-argument", "Experience ID required")
      }

      const experienceService = new ExperienceService(logger)

      let experience: ExperienceEntry | null
      try {
        experience = await experienceService.getEntry(experienceId, userId)
      } catch (serviceError) {
        throw toHttpsError(serviceError, "Failed to retrieve experience entry")
      }

      if (!experience) {
        throw new HttpsError("not-found", "Experience not found")
      }

      logger.info("Retrieved experience", {
        requestId,
        userId,
        experienceId,
      })

      res.status(200).json({
        success: true,
        data: experience,
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "Get experience error",
      })
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
    const req = request as Request
    const res = response as Response
    const requestId = createRequestId()

    try {
      const userId = await prepareExperienceRequest(req, res, { applyRateLimit: false })
      if (!userId) {
        return
      }

      if (req.method !== "GET") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const experienceService = new ExperienceService(logger)

      let experiences: ExperienceEntry[]
      try {
        experiences = await experienceService.listEntries(userId)
      } catch (serviceError) {
        throw toHttpsError(serviceError, "Failed to list experience entries")
      }

      logger.info("Listed experiences", {
        requestId,
        userId,
        count: experiences.length,
      })

      res.status(200).json({
        success: true,
        data: experiences,
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "List experiences error",
      })
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
    const req = request as Request
    const res = response as Response
    const requestId = createRequestId()

    try {
      const userId = await prepareExperienceRequest(req, res)
      if (!userId) {
        return
      }

      if (req.method !== "PUT" && req.method !== "PATCH") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const experienceId = req.query.id as string | undefined
      if (!experienceId) {
        throw new HttpsError("invalid-argument", "Experience ID required")
      }

      const body = req.body as Partial<ExperienceEntry>
      validateDates({ startDate: body.startDate, endDate: body.endDate as string | null })

      const experienceService = new ExperienceService(logger)

      let experience: ExperienceEntry
      try {
        experience = await experienceService.updateEntry(
          experienceId,
          buildUpdatePayload(body),
          userId
        )
      } catch (serviceError) {
        throw toHttpsError(serviceError, "Failed to update experience entry")
      }

      logger.info("Experience updated", {
        requestId,
        userId,
        experienceId,
      })

      res.status(200).json({
        success: true,
        data: experience,
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "Update experience error",
      })
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
    const req = request as Request
    const res = response as Response
    const requestId = createRequestId()

    try {
      const userId = await prepareExperienceRequest(req, res)
      if (!userId) {
        return
      }

      if (req.method !== "DELETE") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const experienceId = req.query.id as string | undefined
      if (!experienceId) {
        throw new HttpsError("invalid-argument", "Experience ID required")
      }

      const experienceService = new ExperienceService(logger)

      try {
        await experienceService.deleteEntry(experienceId, userId)
      } catch (serviceError) {
        throw toHttpsError(serviceError, "Failed to delete experience entry")
      }

      logger.info("Experience deleted", {
        requestId,
        userId,
        experienceId,
      })

      res.status(200).json({
        success: true,
        message: "Experience deleted successfully",
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "Delete experience error",
      })
    }
  }
)
