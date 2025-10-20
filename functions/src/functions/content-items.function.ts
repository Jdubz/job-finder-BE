import { onRequest } from "firebase-functions/v2/https"
import { HttpsError } from "firebase-functions/v2/https"
import { corsHandler } from "../config/cors"
import { RATE_LIMITS } from "../config/versions"
import { ContentItemService } from "../services/content-item.service"
import { authMiddleware } from "../middleware/auth.middleware"
import { appCheckMiddleware } from "../middleware/app-check.middleware"
import { createRateLimitMiddleware } from "../middleware/rate-limit.middleware"
import { createDefaultLogger } from "../utils/logger"
import { createRequestId } from "../utils/request-id"
import type { ContentItem, ContentItemType } from "@jsdubzw/job-finder-shared-types"

const logger = createDefaultLogger()

export const createContentItem = onRequest(
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

        const rateLimitMiddleware = createRateLimitMiddleware("contentItems", RATE_LIMITS.crud)
        await rateLimitMiddleware(request)

        if (request.method !== "POST") {
          throw new HttpsError("invalid-argument", "Method not allowed")
        }

        const body = request.body as Partial<ContentItem>

        if (!body.type || !body.title) {
          throw new HttpsError("invalid-argument", "type and title are required")
        }

        const validTypes: ContentItemType[] = [
          "skill",
          "certification",
          "project",
          "award",
          "publication",
          "volunteer",
        ]
        if (!validTypes.includes(body.type)) {
          throw new HttpsError("invalid-argument", `Invalid type. Must be one of: ${validTypes.join(", ")}`)
        }

        const contentItemService = new ContentItemService(authResult.user.uid, logger)
        const contentItem = await contentItemService.create(body)

        logger.info("Content item created", {
          requestId,
          userId: authResult.user.uid,
          contentItemId: contentItem.id,
          type: contentItem.type,
        })

        response.status(201).json({
          success: true,
          data: contentItem,
        })
      })
    } catch (error) {
      logger.error("Create content item error", { error, requestId })

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

export const getContentItem = onRequest(
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

        const contentItemId = request.query.id as string
        if (!contentItemId) {
          throw new HttpsError("invalid-argument", "Content item ID required")
        }

        const contentItemService = new ContentItemService(authResult.user.uid, logger)
        const contentItem = await contentItemService.get(contentItemId)

        if (!contentItem) {
          throw new HttpsError("not-found", "Content item not found")
        }

        logger.info("Retrieved content item", {
          requestId,
          userId: authResult.user.uid,
          contentItemId,
        })

        response.status(200).json({
          success: true,
          data: contentItem,
        })
      })
    } catch (error) {
      logger.error("Get content item error", { error, requestId })

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

export const listContentItems = onRequest(
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

        const type = request.query.type as ContentItemType | undefined

        const contentItemService = new ContentItemService(authResult.user.uid, logger)
        const contentItems = type
          ? await contentItemService.listByType(type)
          : await contentItemService.list()

        logger.info("Listed content items", {
          requestId,
          userId: authResult.user.uid,
          count: contentItems.length,
          type: type || "all",
        })

        response.status(200).json({
          success: true,
          data: contentItems,
        })
      })
    } catch (error) {
      logger.error("List content items error", { error, requestId })

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

export const updateContentItem = onRequest(
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

        const rateLimitMiddleware = createRateLimitMiddleware("contentItems", RATE_LIMITS.crud)
        await rateLimitMiddleware(request)

        if (request.method !== "PUT" && request.method !== "PATCH") {
          throw new HttpsError("invalid-argument", "Method not allowed")
        }

        const contentItemId = request.query.id as string
        if (!contentItemId) {
          throw new HttpsError("invalid-argument", "Content item ID required")
        }

        const body = request.body as Partial<ContentItem>

        const contentItemService = new ContentItemService(authResult.user.uid, logger)
        const contentItem = await contentItemService.update(contentItemId, body)

        logger.info("Content item updated", {
          requestId,
          userId: authResult.user.uid,
          contentItemId,
        })

        response.status(200).json({
          success: true,
          data: contentItem,
        })
      })
    } catch (error) {
      logger.error("Update content item error", { error, requestId })

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

export const deleteContentItem = onRequest(
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

        const rateLimitMiddleware = createRateLimitMiddleware("contentItems", RATE_LIMITS.crud)
        await rateLimitMiddleware(request)

        if (request.method !== "DELETE") {
          throw new HttpsError("invalid-argument", "Method not allowed")
        }

        const contentItemId = request.query.id as string
        if (!contentItemId) {
          throw new HttpsError("invalid-argument", "Content item ID required")
        }

        const contentItemService = new ContentItemService(authResult.user.uid, logger)
        await contentItemService.delete(contentItemId)

        logger.info("Content item deleted", {
          requestId,
          userId: authResult.user.uid,
          contentItemId,
        })

        response.status(200).json({
          success: true,
          message: "Content item deleted successfully",
        })
      })
    } catch (error) {
      logger.error("Delete content item error", { error, requestId })

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
