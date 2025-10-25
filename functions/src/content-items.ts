import { https } from "firebase-functions/v2"
import type { Request, Response } from "express"
import Joi from "joi"
import { ContentItemService } from "./services/content-item.service"
import { verifyAuthenticatedEditor, type AuthenticatedRequest } from "./middleware/auth.middleware"
import { experienceRateLimiter } from "./middleware/rate-limit.middleware"
import { logger } from "./utils/logger"
import { generateRequestId } from "./utils/request-id"
import { corsHandler } from "./config/cors"
import { PACKAGE_VERSION } from "./config/versions"
import {
  sendSuccessResponse,
  sendErrorResponse,
  sendValidationError,
  sendNotFoundError,
  sendInternalError,
} from "./utils/response-helpers"
import type {
  ContentItemType,
  CreateContentItemData,
  UpdateContentItemData,
} from "./types/content-item.types"

// Initialize service
const contentItemService = new ContentItemService(logger)

// Validation constants
const YYYY_MM_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

// Validation schemas for each content type

// Company validation
const companySchema = Joi.object({
  type: Joi.string().valid("company").required(),
  company: Joi.string().trim().min(1).max(200).required(),
  role: Joi.string().trim().max(200).optional().allow(""),
  location: Joi.string().trim().max(200).optional().allow(""),
  website: Joi.string().uri().optional().allow(""),
  startDate: Joi.string()
    .pattern(YYYY_MM_DATE_PATTERN)
    .required(),
  endDate: Joi.string()
    .pattern(YYYY_MM_DATE_PATTERN)
    .optional()
    .allow("")
    .allow(null),
  summary: Joi.string().trim().max(5000).optional().allow(""),
  accomplishments: Joi.array().items(Joi.string().trim().max(2000)).optional(),
  technologies: Joi.array().items(Joi.string().trim().max(100)).optional(),
  notes: Joi.string().trim().max(2000).optional().allow(""),
  parentId: Joi.string().allow(null).optional(),
  order: Joi.number().integer().min(0).required(),
  visibility: Joi.string().valid("published", "draft", "archived").optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  aiContext: Joi.object({
    emphasize: Joi.boolean().optional(),
    omitFromResume: Joi.boolean().optional(),
    keywords: Joi.array().items(Joi.string()).optional(),
  }).optional(),
})

// Project validation
const projectSchema = Joi.object({
  type: Joi.string().valid("project").required(),
  name: Joi.string().trim().min(1).max(200).required(),
  role: Joi.string().trim().max(200).optional().allow(""),
  startDate: Joi.string()
    .pattern(YYYY_MM_DATE_PATTERN)
    .optional()
    .allow(""),
  endDate: Joi.string()
    .pattern(YYYY_MM_DATE_PATTERN)
    .optional()
    .allow("")
    .allow(null),
  description: Joi.string().trim().min(1).max(5000).required(),
  accomplishments: Joi.array().items(Joi.string().trim().max(2000)).optional(),
  technologies: Joi.array().items(Joi.string().trim().max(100)).optional(),
  challenges: Joi.array().items(Joi.string().trim().max(2000)).optional(),
  links: Joi.array()
    .items(
      Joi.object({
        label: Joi.string().trim().max(100).required(),
        url: Joi.string().uri().required(),
      })
    )
    .optional(),
  context: Joi.string().trim().max(500).optional().allow(""),
  parentId: Joi.string().allow(null).optional(),
  order: Joi.number().integer().min(0).required(),
  visibility: Joi.string().valid("published", "draft", "archived").optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  aiContext: Joi.object({
    emphasize: Joi.boolean().optional(),
    omitFromResume: Joi.boolean().optional(),
    keywords: Joi.array().items(Joi.string()).optional(),
  }).optional(),
})

// Generic validation for other types (can be expanded later)
const createSchema = Joi.alternatives().try(companySchema, projectSchema)

// Update schema (all fields optional except type if provided)
const updateSchema = Joi.object().pattern(Joi.string(), Joi.any())

/**
 * Cloud Function to manage content items
 *
 * Routes:
 * - GET    /content-items/health         - Health check (public)
 * - GET    /content-items                - List all items (public)
 * - GET    /content-items/hierarchy      - Get full hierarchy tree (public)
 * - GET    /content-items/:id            - Get single item (public)
 * - POST   /content-items                - Create item (auth required)
 * - PUT    /content-items/:id            - Update item (auth required)
 * - DELETE /content-items/:id            - Delete item (auth required)
 * - DELETE /content-items/:id/cascade    - Delete item + children (auth required)
 * - POST   /content-items/reorder        - Reorder items (auth required)
 *
 * Query parameters for list:
 * - type: Filter by content type
 * - parentId: Filter by parent (null = root items only)
 * - visibility: Filter by visibility status
 */
const handleContentItemsRequest = async (req: Request, res: Response): Promise<void> => {
  const requestId = generateRequestId()
  ;(req as Request & { requestId: string }).requestId = requestId

  try {
    // Handle CORS
    await new Promise<void>((resolve, reject) => {
      corsHandler(req, res, async () => {
        try {
          // Handle OPTIONS preflight
          if (req.method === "OPTIONS") {
            res.status(204).send("")
            resolve()
            return
          }

          const path = req.path || req.url

          // Route: GET /content-items/health - Health check (public)
          if (req.method === "GET" && path === "/health") {
            res.status(200).json({
              success: true,
              service: "manageContentItems",
              status: "healthy",
              version: PACKAGE_VERSION,
              timestamp: new Date().toISOString(),
            })
            resolve()
            return
          }

          // Apply rate limiting for public GET requests
          if (req.method === "GET" && path !== "/health") {
            await new Promise<void>((resolveRateLimit, rejectRateLimit) => {
              experienceRateLimiter(req, res, (err) => {
                if (err) rejectRateLimit(err)
                else resolveRateLimit()
              })
            })
          }

          // Route: GET /content-items/hierarchy - Get full hierarchy (public)
          if (req.method === "GET" && path === "/content-items/hierarchy") {
            await handleGetHierarchy(req, res, requestId)
            resolve()
            return
          }

          // Route: GET /content-items/:id - Get single item (public)
          if (req.method === "GET" && path.startsWith("/content-items/") && path !== "/content-items") {
            const id = path.replace("/content-items/", "")
            await handleGetItem(req, res, requestId, id)
            resolve()
            return
          }

          // Route: GET /content-items - List items (public)
          if (req.method === "GET" && path === "/content-items") {
            await handleListItems(req, res, requestId)
            resolve()
            return
          }

          // All other routes require authentication
          await new Promise<void>((resolveAuth, rejectAuth) => {
            verifyAuthenticatedEditor(logger)(req as AuthenticatedRequest, res, (err) => {
              if (err) rejectAuth(err)
              else resolveAuth()
            })
          })

          // Route: POST /content-items/reorder - Reorder items
          if (req.method === "POST" && path === "/content-items/reorder") {
            await handleReorderItems(req as AuthenticatedRequest, res, requestId)
            resolve()
            return
          }

          // Route: POST /content-items - Create item
          if (req.method === "POST" && path === "/content-items") {
            await handleCreateItem(req as AuthenticatedRequest, res, requestId)
            resolve()
            return
          }

          // Route: DELETE /content-items/:id/cascade - Delete with children
          if (req.method === "DELETE" && path.match(/^\/content-items\/[^/]+\/cascade$/)) {
            const id = path.replace("/content-items/", "").replace("/cascade", "")
            await handleDeleteWithChildren(req as AuthenticatedRequest, res, requestId, id)
            resolve()
            return
          }

          // Route: PUT /content-items/:id - Update item
          if (req.method === "PUT" && path.startsWith("/content-items/")) {
            const id = path.replace("/content-items/", "")
            await handleUpdateItem(req as AuthenticatedRequest, res, requestId, id)
            resolve()
            return
          }

          // Route: DELETE /content-items/:id - Delete item
          if (req.method === "DELETE" && path.startsWith("/content-items/")) {
            const id = path.replace("/content-items/", "")
            await handleDeleteItem(req as AuthenticatedRequest, res, requestId, id)
            resolve()
            return
          }

          // Unknown route
          sendErrorResponse(res, 405, "Method not allowed", "METHOD_NOT_ALLOWED", {
            logger,
            requestId,
            logContext: { method: req.method, path },
          })
          resolve()
        } catch (err) {
          reject(err)
        }
      })
    })
  } catch (error) {
    sendInternalError(res, "Unexpected error in content items handler", error instanceof Error ? error : undefined, {
      logger,
      requestId,
      logContext: { method: req.method, url: req.url },
    })
  }
}

/**
 * GET /content-items - List items with optional filters (public)
 */
async function handleListItems(req: Request, res: Response, requestId: string): Promise<void> {
  try {
    const { type, parentId, visibility, limit } = req.query

    logger.info("Listing content items", { requestId, filters: req.query })

    const options = {
      type: type as ContentItemType | undefined,
      parentId: parentId === "null" ? null : (parentId as string | undefined),
      visibility: visibility as "published" | "draft" | "archived" | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    }

    const items = await contentItemService.listItems(options)

    sendSuccessResponse(res, {
        items,
        count: items.length,
      }, { logger, requestId })
  } catch (error) {
    logger.error("Failed to list content items", { error, requestId })

    sendInternalError(res, "Database error", error instanceof Error ? error : undefined, { logger, requestId })
  }
}

/**
 * GET /content-items/hierarchy - Get full hierarchy tree (public)
 */
async function handleGetHierarchy(req: Request, res: Response, requestId: string): Promise<void> {
  try {
    logger.info("Getting content items hierarchy", { requestId })

    const hierarchy = await contentItemService.getHierarchy()

    sendSuccessResponse(res, { hierarchy }, { logger, requestId })
  } catch (error) {
    logger.error("Failed to get hierarchy", { error, requestId })

    sendInternalError(res, "Database error", error instanceof Error ? error : undefined, { logger, requestId })
  }
}

/**
 * GET /content-items/:id - Get single item (public)
 */
async function handleGetItem(req: Request, res: Response, requestId: string, id: string): Promise<void> {
  try {
    logger.info("Getting content item", { requestId, id })

    const item = await contentItemService.getItem(id)

    if (!item) {
      sendNotFoundError(res, "Content item", { logger, requestId })
      return
    }

    sendSuccessResponse(res, { item }, { logger, requestId })
  } catch (error) {
    logger.error("Failed to get content item", { error, requestId, id })

    sendInternalError(res, "Database error", error instanceof Error ? error : undefined, { logger, requestId })
  }
}

/**
 * POST /content-items - Create item (auth required)
 */
async function handleCreateItem(req: AuthenticatedRequest, res: Response, requestId: string): Promise<void> {
  try {
    // Validate request body
    const { error, value } = createSchema.validate(req.body)

    if (error) {
      sendValidationError(res, error.details[0].message, {
        logger,
        requestId,
        logContext: { details: error.details },
      })
      return
    }

    const userEmail = req.user!.email

    logger.info("Creating content item", {
      requestId,
      type: value.type,
      userEmail,
    })

    const item = await contentItemService.createItem(value as CreateContentItemData, userEmail)

    sendSuccessResponse(res, { item }, { logger, requestId, statusCode: 201 })
  } catch (error) {
    logger.error("Failed to create content item", {
      error,
      requestId,
      userEmail: req.user?.email,
    })

    sendInternalError(res, "Database error", error instanceof Error ? error : undefined, { logger, requestId })
  }
}

/**
 * PUT /content-items/:id - Update item (auth required)
 */
async function handleUpdateItem(
  req: AuthenticatedRequest,
  res: Response,
  requestId: string,
  id: string
): Promise<void> {
  try {
    // Validate request body
    const { error, value } = updateSchema.validate(req.body)

    if (error) {
      sendValidationError(res, error.details[0].message, {
        logger,
        requestId,
        logContext: { details: error.details },
      })
      return
    }

    const userEmail = req.user!.email

    logger.info("Updating content item", {
      requestId,
      id,
      userEmail,
      fieldsToUpdate: Object.keys(value),
    })

    const item = await contentItemService.updateItem(id, value as UpdateContentItemData, userEmail)

    sendSuccessResponse(res, { item }, { logger, requestId })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes("not found")) {
      logger.warning("Content item not found for update", { id, requestId })

      sendNotFoundError(res, "Content item", { logger, requestId })
      return
    }

    logger.error("Failed to update content item", {
      error,
      requestId,
      id,
      userEmail: req.user?.email,
    })

    sendInternalError(res, "Database error", error instanceof Error ? error : undefined, { logger, requestId })
  }
}

/**
 * DELETE /content-items/:id - Delete item (auth required)
 */
async function handleDeleteItem(
  req: AuthenticatedRequest,
  res: Response,
  requestId: string,
  id: string
): Promise<void> {
  try {
    logger.info("Deleting content item", {
      requestId,
      id,
      userEmail: req.user?.email,
    })

    await contentItemService.deleteItem(id)

    res.status(200).json({
      success: true,
      message: "Content item deleted successfully",
      requestId,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes("not found")) {
      logger.warning("Content item not found for delete", { id, requestId })

      sendNotFoundError(res, "Content item", { logger, requestId })
      return
    }

    logger.error("Failed to delete content item", {
      error,
      requestId,
      id,
      userEmail: req.user?.email,
    })

    sendInternalError(res, "Database error", error instanceof Error ? error : undefined, { logger, requestId })
  }
}

/**
 * DELETE /content-items/:id/cascade - Delete item and all children (auth required)
 */
async function handleDeleteWithChildren(
  req: AuthenticatedRequest,
  res: Response,
  requestId: string,
  id: string
): Promise<void> {
  try {
    logger.info("Deleting content item with children", {
      requestId,
      id,
      userEmail: req.user?.email,
    })

    const deletedCount = await contentItemService.deleteWithChildren(id)

    res.status(200).json({
      success: true,
      message: `Deleted ${deletedCount} items (including children)`,
      data: { deletedCount },
      requestId,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes("not found")) {
      logger.warning("Content item not found for cascade delete", { id, requestId })

      sendNotFoundError(res, "Content item", { logger, requestId })
      return
    }

    logger.error("Failed to delete content item with children", {
      error,
      requestId,
      id,
      userEmail: req.user?.email,
    })

    sendInternalError(res, "Database error", error instanceof Error ? error : undefined, { logger, requestId })
  }
}

/**
 * POST /content-items/reorder - Reorder items (auth required)
 * Body: { items: [{ id, order }, ...] }
 */
async function handleReorderItems(req: AuthenticatedRequest, res: Response, requestId: string): Promise<void> {
  try {
    const { items } = req.body

    if (!Array.isArray(items)) {
      sendValidationError(res, "items must be an array", { logger, requestId })
      return
    }

    const userEmail = req.user!.email

    logger.info("Reordering content items", {
      requestId,
      count: items.length,
      userEmail,
    })

    await contentItemService.reorderItems(items, userEmail)

    res.status(200).json({
      success: true,
      message: `Reordered ${items.length} items`,
      requestId,
    })
  } catch (error) {
    logger.error("Failed to reorder content items", {
      error,
      requestId,
      userEmail: req.user?.email,
    })

    sendInternalError(res, "Database error", error instanceof Error ? error : undefined, { logger, requestId })
  }
}

/**
 * Export as Firebase HTTP Function (v2)
 */
export const manageContentItems = https.onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    maxInstances: 10,
    timeoutSeconds: 60,
    serviceAccount: "firebase-admin@static-sites-257923.iam.gserviceaccount.com",
  },
  handleContentItemsRequest
)
