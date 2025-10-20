import { onRequest, HttpsError, type FunctionsErrorCode } from "firebase-functions/v2/https"
import type { Request, Response } from "express"
import { contentItemsCorsHandler } from "../config/cors"
import { ContentItemService } from "../services/content-item.service"
import { verifyAuth } from "../middleware/auth.middleware"
import { verifyAppCheck } from "../middleware/app-check.middleware"
import { contentItemsRateLimiter } from "../middleware/rate-limit.middleware"
import { createDefaultLogger } from "../utils/logger"
import { createRequestId } from "../utils/request-id"
import { runMiddleware } from "../utils/run-middleware"
import type {
  ContentItemType,
  ContentItemVisibility,
  CreateContentItemData,
  UpdateContentItemData,
} from "@jsdubzw/job-finder-shared-types"

const logger = createDefaultLogger()
const VALID_TYPES: ContentItemType[] = [
  "company",
  "project",
  "skill-group",
  "education",
  "profile-section",
  "accomplishment",
]
const VALID_VISIBILITIES: ContentItemVisibility[] = ["published", "draft", "archived"]
const RESERVED_FIELDS = ["id", "userId", "createdAt", "updatedAt", "createdBy", "updatedBy"]

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

async function prepareContentItemsRequest(
  req: Request,
  res: Response,
  { applyRateLimit = true }: { applyRateLimit?: boolean } = {}
): Promise<string | null> {
  await runMiddleware(req, res, contentItemsCorsHandler)
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

function toHttpsError(
  error: unknown,
  fallbackMessage: string,
  fallbackCode: FunctionsErrorCode
): HttpsError {
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

    return new HttpsError(fallbackCode, message)
  }

  return new HttpsError("internal", fallbackMessage)
}

function sanitizeCreatePayload(body: Partial<CreateContentItemData>): CreateContentItemData {
  const sanitized = { ...body } as Record<string, unknown>
  for (const field of RESERVED_FIELDS) {
    delete sanitized[field]
  }
  return sanitized as CreateContentItemData
}

function sanitizeUpdatePayload(body: Partial<UpdateContentItemData>): UpdateContentItemData {
  const sanitized = { ...body } as Record<string, unknown>
  for (const field of [...RESERVED_FIELDS, "type"]) {
    delete sanitized[field]
  }
  return sanitized as UpdateContentItemData
}

function parseLimit(value: string | string[] | undefined): number | undefined {
  if (!value) return undefined
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new HttpsError("invalid-argument", "limit must be a positive integer")
  }
  return parsed
}

function parseContentItemType(value: string | string[] | undefined): ContentItemType | undefined {
  if (!value) return undefined
  const raw = Array.isArray(value) ? value[0] : value
  if (!VALID_TYPES.includes(raw as ContentItemType)) {
    throw new HttpsError("invalid-argument", "Invalid content item type filter")
  }
  return raw as ContentItemType
}

function parseVisibility(
  value: string | string[] | undefined
): ContentItemVisibility | undefined {
  if (!value) return undefined
  const raw = Array.isArray(value) ? value[0] : value
  if (!VALID_VISIBILITIES.includes(raw as ContentItemVisibility)) {
    throw new HttpsError("invalid-argument", "Invalid visibility filter")
  }
  return raw as ContentItemVisibility
}

export const createContentItem = onRequest(
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
      const userId = await prepareContentItemsRequest(req, res)
      if (!userId) {
        return
      }

      if (req.method !== "POST") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const body = req.body as Partial<CreateContentItemData> & { type?: unknown }

      if (typeof body?.type !== "string" || !VALID_TYPES.includes(body.type as ContentItemType)) {
        throw new HttpsError("invalid-argument", "Invalid or missing content item type")
      }

      const contentItemService = new ContentItemService(logger)

      let contentItem: unknown
      try {
        contentItem = await contentItemService.createItem(
          sanitizeCreatePayload(body),
          userId
        )
      } catch (serviceError) {
        throw toHttpsError(serviceError, "Failed to create content item", "invalid-argument")
      }

      logger.info("Content item created", {
        requestId,
        userId,
        contentItemId: (contentItem as { id?: string }).id,
        type: (contentItem as { type?: string }).type,
      })

      res.status(201).json({
        success: true,
        data: contentItem,
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "Create content item error",
      })
    }
  }
)

export const getContentItem = onRequest(
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
      const userId = await prepareContentItemsRequest(req, res, { applyRateLimit: false })
      if (!userId) {
        return
      }

      if (req.method !== "GET") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const contentItemId = req.query.id as string | undefined
      if (!contentItemId) {
        throw new HttpsError("invalid-argument", "Content item ID required")
      }

      const contentItemService = new ContentItemService(logger)

      let contentItem: unknown
      try {
        contentItem = await contentItemService.getItem(contentItemId, userId)
      } catch (serviceError) {
        throw toHttpsError(serviceError, "Failed to retrieve content item", "internal")
      }

      if (!contentItem) {
        throw new HttpsError("not-found", "Content item not found")
      }

      logger.info("Retrieved content item", {
        requestId,
        userId,
        contentItemId,
      })

      res.status(200).json({
        success: true,
        data: contentItem,
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "Get content item error",
      })
    }
  }
)

export const listContentItems = onRequest(
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
      const userId = await prepareContentItemsRequest(req, res, { applyRateLimit: false })
      if (!userId) {
        return
      }

      if (req.method !== "GET") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const options = {
        type: parseContentItemType(req.query.type as string | string[] | undefined),
        visibility: parseVisibility(req.query.visibility as string | string[] | undefined),
        parentId: req.query.parentId === "null" ? undefined : (req.query.parentId as string | undefined),
        limit: parseLimit(req.query.limit as string | string[] | undefined),
      }

      const contentItemService = new ContentItemService(logger)

      let items: unknown
      try {
        items = await contentItemService.listItems(userId, options)
      } catch (serviceError) {
        throw toHttpsError(serviceError, "Failed to list content items", "internal")
      }

      logger.info("Listed content items", {
        requestId,
        userId,
        count: Array.isArray(items) ? items.length : undefined,
        type: options.type ?? "all",
      })

      res.status(200).json({
        success: true,
        data: items,
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "List content items error",
      })
    }
  }
)

export const updateContentItem = onRequest(
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
      const userId = await prepareContentItemsRequest(req, res)
      if (!userId) {
        return
      }

      if (req.method !== "PUT" && req.method !== "PATCH") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const contentItemId = req.query.id as string | undefined
      if (!contentItemId) {
        throw new HttpsError("invalid-argument", "Content item ID required")
      }

      const body = req.body as Partial<UpdateContentItemData>
      const contentItemService = new ContentItemService(logger)

      let contentItem: unknown
      try {
        contentItem = await contentItemService.updateItem(
          contentItemId,
          sanitizeUpdatePayload(body),
          userId
        )
      } catch (serviceError) {
        throw toHttpsError(serviceError, "Failed to update content item", "invalid-argument")
      }

      logger.info("Content item updated", {
        requestId,
        userId,
        contentItemId,
      })

      res.status(200).json({
        success: true,
        data: contentItem,
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "Update content item error",
      })
    }
  }
)

export const deleteContentItem = onRequest(
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
      const userId = await prepareContentItemsRequest(req, res)
      if (!userId) {
        return
      }

      if (req.method !== "DELETE") {
        throw new HttpsError("invalid-argument", "Method not allowed")
      }

      const contentItemId = req.query.id as string | undefined
      if (!contentItemId) {
        throw new HttpsError("invalid-argument", "Content item ID required")
      }

      const cascade = req.query.cascade !== "false"
      const contentItemService = new ContentItemService(logger)

      try {
        await contentItemService.deleteItem(contentItemId, userId, cascade)
      } catch (serviceError) {
        throw toHttpsError(serviceError, "Failed to delete content item", "invalid-argument")
      }

      logger.info("Content item deleted", {
        requestId,
        userId,
        contentItemId,
        cascade,
      })

      res.status(200).json({
        success: true,
        message: "Content item deleted successfully",
      })
    } catch (error) {
      handleError(error, res, {
        requestId,
        logMessage: "Delete content item error",
      })
    }
  }
)
