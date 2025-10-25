/**
 * Job Queue Cloud Function
 * 
 * Manages job queue operations for the Job Finder application.
 * Provides APIs for job submission, queue management, and configuration.
 */

import * as functions from "firebase-functions/v2";
import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import Joi from "joi";
import { JobQueueService } from "./services/job-queue.service";
import { verifyAuthenticatedEditor, verifyAuthenticatedUser } from "./middleware/auth.middleware";
import { logger } from "./utils/logger";
import { generateRequestId } from "./utils/request-id";
import { corsHandler } from "./config/cors";
import { JOB_QUEUE_ERROR_CODES } from "./config/error-codes";
import { PACKAGE_VERSION } from "./config/versions";
import {
  sendSuccessResponse,
  sendErrorResponse,
  sendValidationError,
  sendAuthError,
  sendNotFoundError,
  sendRateLimitError,
  sendInternalError,
} from "./utils/response-helpers";

// Initialize service
const jobQueueService = new JobQueueService(logger);

// Validation schemas
const submitJobSchema = Joi.object({
  url: Joi.string().uri().trim().required(),
  companyName: Joi.string().trim().max(200).optional().allow(""),
  companyUrl: Joi.string().uri().trim().optional().allow(""),
  generationId: Joi.string().trim().optional(),
});

const submitCompanySchema = Joi.object({
  companyName: Joi.string().trim().min(2).max(200).required(),
  websiteUrl: Joi.string().uri().trim().required(),
  source: Joi.string()
    .valid("manual_submission", "user_request", "automated_scan")
    .required(),
});

const updateStopListSchema = Joi.object({
  excludedCompanies: Joi.array().items(Joi.string().trim().max(200)).required(),
  excludedKeywords: Joi.array().items(Joi.string().trim().max(200)).required(),
  excludedDomains: Joi.array().items(Joi.string().trim().max(200)).required(),
});

const updateAISettingsSchema = Joi.object({
  provider: Joi.string().valid("claude", "openai", "gemini").required(),
  model: Joi.string().trim().max(100).required(),
  minMatchScore: Joi.number().min(0).max(100).required(),
  costBudgetDaily: Joi.number().min(0).required(),
});

const updateQueueSettingsSchema = Joi.object({
  maxRetries: Joi.number().integer().min(0).max(10).required(),
  retryDelaySeconds: Joi.number().integer().min(0).required(),
  processingTimeout: Joi.number().integer().min(0).required(),
});

const submitScrapeSchema = Joi.object({
  scrape_config: Joi.object({
    target_matches: Joi.number().integer().min(1).max(999).allow(null).optional(),
    max_sources: Joi.number().integer().min(1).max(999).allow(null).optional(),
    source_ids: Joi.array().items(Joi.string()).allow(null).optional(),
    min_match_score: Joi.number().integer().min(0).max(100).allow(null).optional(),
  }).optional(),
});


/**
 * Handle POST /submit - Submit job to queue (public)
 */
async function handleSubmitJob(
  req: Request,
  res: Response,
  requestId: string
) {
  try {
    // Validate request body
    const { error, value } = submitJobSchema.validate(req.body);

    if (error) {
      sendValidationError(res, error.details[0].message, {
        logger,
        requestId,
        logContext: { details: error.details },
      });
      return;
    }

    const { url, companyName, generationId } = value;

    // Get user ID if authenticated (optional)
    const userId = (req as any).user?.uid || null;

    // Submit job to queue
    const queueItem = await jobQueueService.submitJob(
      url,
      companyName,
      userId,
      generationId
    );

    sendSuccessResponse(
      res,
      {
        id: queueItem.id,
        status: queueItem.status,
        message: generationId
          ? "Job submitted with pre-generated documents"
          : "Job submitted successfully",
      },
      {
        logger,
        requestId,
        logContext: { queueItemId: queueItem.id, userId },
      }
    );
  } catch (error) {
    sendInternalError(
      res,
      "Failed to submit job",
      error instanceof Error ? error : undefined,
      { logger, requestId }
    );
  }
}

/**
 * Handle POST /submit-company - Submit company to queue (editor only)
 */
async function handleSubmitCompany(
  req: Request,
  res: Response,
  requestId: string
) {
  try {
    // Validate request body
    const { error, value } = submitCompanySchema.validate(req.body);

    if (error) {
      sendValidationError(res, error.details[0].message, {
        logger,
        requestId,
        logContext: { details: error.details },
      });
      return;
    }

    const { companyName, websiteUrl, source } = value;

    // Get user ID (required for this route)
    const userId = (req as any).user?.uid || null;

    // Submit company to queue
    const queueItem = await jobQueueService.submitCompany(
      companyName,
      websiteUrl,
      source,
      userId
    );

    sendSuccessResponse(
      res,
      {
        id: queueItem.id,
        status: queueItem.status,
        message: "Company submitted successfully",
      },
      {
        logger,
        requestId,
        logContext: { queueItemId: queueItem.id, userId },
      }
    );
  } catch (error) {
    sendInternalError(
      res,
      "Failed to submit company",
      error instanceof Error ? error : undefined,
      { logger, requestId }
    );
  }
}

/**
 * Handle POST /submit-scrape - Submit scrape request (auth required)
 */
async function handleSubmitScrape(
  req: Request,
  res: Response,
  requestId: string
) {
  try {
    // Validate request body
    const { error, value } = submitScrapeSchema.validate(req.body);

    if (error) {
      sendValidationError(res, error.details[0].message, {
        logger,
        requestId,
        logContext: { details: error.details },
      });
      return;
    }

    const { scrape_config } = value;

    // Get user ID (required for this route)
    const userId = (req as any).user?.uid;

    if (!userId) {
      sendAuthError(res, "Authentication required", { logger, requestId });
      return;
    }

    // Check if user already has a pending scrape
    const hasPending = await jobQueueService.hasPendingScrape(userId);

    if (hasPending) {
      sendRateLimitError(res, "You already have a scrape request in progress", {
        logger,
        requestId,
        logContext: { userId },
      });
      return;
    }

    // Submit scrape request
    const queueItem = await jobQueueService.submitScrape(userId, scrape_config);

    sendSuccessResponse(
      res,
      {
        id: queueItem.id,
        status: queueItem.status,
        message: "Scrape request submitted successfully",
      },
      {
        logger,
        requestId,
        logContext: { queueItemId: queueItem.id, userId },
      }
    );
  } catch (error) {
    sendInternalError(
      res,
      "Failed to submit scrape request",
      error instanceof Error ? error : undefined,
      { logger, requestId }
    );
  }
}

/**
 * Handle GET /has-pending-scrape - Check for pending scrape (auth required)
 */
async function handleHasPendingScrape(
  req: Request,
  res: Response,
  requestId: string
) {
  try {
    // Get user ID (required for this route)
    const userId = (req as any).user?.uid;

    if (!userId) {
      sendAuthError(res, "Authentication required", { logger, requestId });
      return;
    }

    // Check for pending scrape
    const hasPending = await jobQueueService.hasPendingScrape(userId);

    logger.info("Pending scrape check", {
      requestId,
      userId,
      hasPending,
    });

    sendSuccessResponse(


      res,


      {
        hasPendingScrape: hasPending,
      },


      {


        logger,


        requestId: requestId,


      }


    );
  } catch (error) {
    logger.error("Failed to check for pending scrape", { error, requestId });

    sendInternalError(


      res,


      "Failed to check for pending scrape",


      undefined,


      { logger, requestId: requestId }


    );
  }
}

/**
 * Handle GET /status/:id - Get queue item status (public)
 */
async function handleGetQueueStatus(
  _req: Request,
  res: Response,
  requestId: string,
  id: string
) {
  try {
    const queueItem = await jobQueueService.getQueueStatus(id);

    if (!queueItem) {
      logger.warning("Queue item not found", {
        requestId,
        queueItemId: id,
      });

      sendNotFoundError(res, "Queue item", { logger, requestId });
      return;
    }

    logger.info("Queue status retrieved", {
      requestId,
      queueItemId: id,
    });

    sendSuccessResponse(res, queueItem, { logger, requestId });
  } catch (error) {
    logger.error("Failed to get queue status", { error, requestId, id });

    sendInternalError(


      res,


      "Failed to get queue status",


      undefined,


      { logger, requestId: requestId }


    );
  }
}

/**
 * Handle GET /stats - Get queue statistics (public)
 */
async function handleGetStats(
  _req: Request,
  res: Response,
  requestId: string
) {
  try {
    const stats = await jobQueueService.getQueueStats();

    logger.info("Queue stats retrieved", {
      requestId,
      total: stats.total,
    });

    sendSuccessResponse(res, stats, { logger, requestId });
  } catch (error) {
    logger.error("Failed to get queue stats", { error, requestId });

    sendInternalError(


      res,


      "Failed to get queue stats",


      undefined,


      { logger, requestId: requestId }


    );
  }
}

/**
 * Handle GET /config/stop-list - Get stop list (public, read-only)
 */
async function handleGetStopList(
  _req: Request,
  res: Response,
  requestId: string
) {
  try {
    const stopList = await jobQueueService.getStopList();

    logger.info("Stop list retrieved", {
      requestId,
      companiesCount: stopList.excludedCompanies.length,
    });

    sendSuccessResponse(res, stopList, { logger, requestId });
  } catch (error) {
    logger.error("Failed to get stop list", { error, requestId });

    sendInternalError(


      res,


      "Failed to get stop list",


      undefined,


      { logger, requestId: requestId }


    );
  }
}

/**
 * Handle GET /config/ai-settings - Get AI settings (public, read-only)
 */
async function handleGetAISettings(
  _req: Request,
  res: Response,
  requestId: string
) {
  try {
    const settings = await jobQueueService.getAISettings();

    logger.info("AI settings retrieved", {
      requestId,
    });

    sendSuccessResponse(res, settings, { logger, requestId });
  } catch (error) {
    logger.error("Failed to get AI settings", { error, requestId });

    sendInternalError(


      res,


      "Failed to get AI settings",


      undefined,


      { logger, requestId: requestId }


    );
  }
}

/**
 * Handle GET /config/queue-settings - Get queue settings (public, read-only)
 */
async function handleGetQueueSettings(
  _req: Request,
  res: Response,
  requestId: string
) {
  try {
    const settings = await jobQueueService.getQueueSettings();

    logger.info("Queue settings retrieved", {
      requestId,
    });

    sendSuccessResponse(res, settings, { logger, requestId });
  } catch (error) {
    logger.error("Failed to get queue settings", { error, requestId });

    sendInternalError(


      res,


      "Failed to get queue settings",


      undefined,


      { logger, requestId: requestId }


    );
  }
}

/**
 * Handle POST /retry/:id - Retry failed queue item (editor only)
 */
async function handleRetryQueueItem(
  _req: Request,
  res: Response,
  requestId: string,
  id: string
) {
  try {
    await jobQueueService.retryQueueItem(id);

    logger.info("Queue item retry initiated", {
      requestId,
      queueItemId: id,
    });

    sendSuccessResponse(


      res,


      {
        id,
        message: "Queue item retry initiated",
      },


      {


        logger,


        requestId: requestId,


      }


    );
  } catch (error) {
    logger.error("Failed to retry queue item", { error, requestId, id });

    const errorMessage =
      error instanceof Error ? error.message : "Failed to retry queue item";

    sendValidationError(


      res,


      errorMessage,


      { logger, requestId: requestId }


    );
  }
}

/**
 * Handle DELETE /queue/:id - Delete queue item (editor only)
 */
async function handleDeleteQueueItem(
  _req: Request,
  res: Response,
  requestId: string,
  id: string
) {
  try {
    await jobQueueService.deleteQueueItem(id);

    logger.info("Queue item deleted", {
      requestId,
      queueItemId: id,
    });

    sendSuccessResponse(


      res,


      {
        id,
        message: "Queue item deleted successfully",
      },


      {


        logger,


        requestId: requestId,


      }


    );
  } catch (error) {
    logger.error("Failed to delete queue item", { error, requestId, id });

    sendInternalError(


      res,


      "Failed to delete queue item",


      undefined,


      { logger, requestId: requestId }


    );
  }
}

/**
 * Handle PUT /config/stop-list - Update stop list (editor only)
 */
async function handleUpdateStopList(
  req: Request,
  res: Response,
  requestId: string
) {
  try {
    // Validate request body
    const { error, value } = updateStopListSchema.validate(req.body);

    if (error) {
      logger.warning("Invalid update stop list request", {
        requestId,
        error: error.details,
      });

      sendValidationError(


        res,


        error.details[0].message,


        { logger, requestId: requestId }


      );
      return;
    }

    await jobQueueService.updateStopList(value);

    logger.info("Stop list updated", {
      requestId,
      companiesCount: value.excludedCompanies.length,
    });

    sendSuccessResponse(


      res,


      {
        message: "Stop list updated successfully",
      },


      {


        logger,


        requestId: requestId,


      }


    );
  } catch (error) {
    logger.error("Failed to update stop list", { error, requestId });

    sendInternalError(


      res,


      "Failed to update stop list",


      undefined,


      { logger, requestId: requestId }


    );
  }
}

/**
 * Handle PUT /config/ai-settings - Update AI settings (editor only)
 */
async function handleUpdateAISettings(
  req: Request,
  res: Response,
  requestId: string
) {
  try {
    // Validate request body
    const { error, value } = updateAISettingsSchema.validate(req.body);

    if (error) {
      logger.warning("Invalid update AI settings request", {
        requestId,
        error: error.details,
      });

      sendValidationError(


        res,


        error.details[0].message,


        { logger, requestId: requestId }


      );
      return;
    }

    await jobQueueService.updateAISettings(value);

    logger.info("AI settings updated", {
      requestId,
    });

    sendSuccessResponse(


      res,


      {
        message: "AI settings updated successfully",
      },


      {


        logger,


        requestId: requestId,


      }


    );
  } catch (error) {
    logger.error("Failed to update AI settings", { error, requestId });

    sendInternalError(


      res,


      "Failed to update AI settings",


      undefined,


      { logger, requestId: requestId }


    );
  }
}

/**
 * Handle PUT /config/queue-settings - Update queue settings (editor only)
 */
async function handleUpdateQueueSettings(
  req: Request,
  res: Response,
  requestId: string
) {
  try {
    // Validate request body
    const { error, value } = updateQueueSettingsSchema.validate(req.body);

    if (error) {
      logger.warning("Invalid update queue settings request", {
        requestId,
        error: error.details,
      });

      sendValidationError(


        res,


        error.details[0].message,


        { logger, requestId: requestId }


      );
      return;
    }

    await jobQueueService.updateQueueSettings(value);

    logger.info("Queue settings updated", {
      requestId,
    });

    sendSuccessResponse(


      res,


      {
        message: "Queue settings updated successfully",
      },


      {


        logger,


        requestId: requestId,


      }


    );
  } catch (error) {
    logger.error("Failed to update queue settings", { error, requestId });

    sendInternalError(


      res,


      "Failed to update queue settings",


      undefined,


      { logger, requestId: requestId }


    );
  }
}

/**
 * Cloud Function to manage job queue operations
 *
 * Routes:
 * - GET    /health                  - Health check (public)
 * - POST   /submit                  - Submit job to queue (public)
 * - POST   /submit-company          - Submit company to queue (editor only)
 * - POST   /submit-scrape           - Submit scrape request (auth required)
 * - GET    /has-pending-scrape      - Check for pending scrape (auth required)
 * - GET    /status/:id              - Get queue item status (public)
 * - GET    /stats                   - Get queue statistics (public)
 * - GET    /config/stop-list        - Get stop list (public, read-only)
 * - GET    /config/ai-settings      - Get AI settings (public, read-only)
 * - GET    /config/queue-settings   - Get queue settings (public, read-only)
 * - POST   /retry/:id               - Retry failed queue item (editor only)
 * - DELETE /queue/:id               - Delete queue item (editor only)
 * - PUT    /config/stop-list        - Update stop list (editor only)
 * - PUT    /config/ai-settings      - Update AI settings (editor only)
 * - PUT    /config/queue-settings   - Update queue settings (editor only)
 */
const handleJobQueueRequest = async (req: Request, res: Response) => {
  const requestId = generateRequestId();
  (req as any).requestId = requestId;

  try {
    // Handle CORS
    await new Promise<void>((resolve, reject) => {
      corsHandler(req, res, async () => {
        try {
          // Handle OPTIONS preflight
          if (req.method === "OPTIONS") {
            res.status(204).send("");
            resolve();
            return;
          }

          const path = req.path || req.url;

          // Route: GET /health - Health check (public)
          if (req.method === "GET" && path === "/health") {
            res.status(200).json({
              success: true,
              service: "manageJobQueue",
              status: "healthy",
              version: PACKAGE_VERSION,
              timestamp: new Date().toISOString(),
            });
            resolve();
            return;
          }

          // Public routes (no authentication required)
          const publicRoutes =
            ["/submit", "/stats"].some((route) => path === route) ||
            path.startsWith("/status/") ||
            (req.method === "GET" && path.startsWith("/config/"));

          if (publicRoutes) {
            // Route: POST /submit
            if (req.method === "POST" && path === "/submit") {
              await handleSubmitJob(req, res, requestId);
              resolve();
              return;
            }

            // Route: GET /status/:id
            if (req.method === "GET" && path.startsWith("/status/")) {
              const id = path.replace("/status/", "");
              await handleGetQueueStatus(req, res, requestId, id);
              resolve();
              return;
            }

            // Route: GET /stats
            if (req.method === "GET" && path === "/stats") {
              await handleGetStats(req, res, requestId);
              resolve();
              return;
            }

            // Route: GET /config/stop-list
            if (req.method === "GET" && path === "/config/stop-list") {
              await handleGetStopList(req, res, requestId);
              resolve();
              return;
            }

            // Route: GET /config/ai-settings
            if (req.method === "GET" && path === "/config/ai-settings") {
              await handleGetAISettings(req, res, requestId);
              resolve();
              return;
            }

            // Route: GET /config/queue-settings
            if (req.method === "GET" && path === "/config/queue-settings") {
              await handleGetQueueSettings(req, res, requestId);
              resolve();
              return;
            }
          }

          // Authenticated routes (require auth but not editor role)
          const authRequiredRoutes = ["/submit-scrape", "/has-pending-scrape"];

          if (authRequiredRoutes.some((route) => path === route)) {
            // Verify authentication
            await new Promise<void>((resolveAuth, rejectAuth) => {
              verifyAuthenticatedUser(logger)(req, res, (err?: any) => {
                if (err) {
                  rejectAuth(err);
                } else {
                  resolveAuth();
                }
              });
            });

            // Route: POST /submit-scrape
            if (req.method === "POST" && path === "/submit-scrape") {
              await handleSubmitScrape(req, res, requestId);
              resolve();
              return;
            }

            // Route: GET /has-pending-scrape
            if (req.method === "GET" && path === "/has-pending-scrape") {
              await handleHasPendingScrape(req, res, requestId);
              resolve();
              return;
            }
          }

          // Editor-only routes
          const editorRoutes =
            ["/submit-company"].some((route) => path === route) ||
            path.startsWith("/retry/") ||
            path.startsWith("/queue/") ||
            (req.method === "PUT" && path.startsWith("/config/"));

          if (editorRoutes) {
            // Verify editor authentication
            await new Promise<void>((resolveAuth, rejectAuth) => {
              verifyAuthenticatedEditor(logger)(req, res, (err?: any) => {
                if (err) {
                  rejectAuth(err);
                } else {
                  resolveAuth();
                }
              });
            });

            // Route: POST /submit-company
            if (req.method === "POST" && path === "/submit-company") {
              await handleSubmitCompany(req, res, requestId);
              resolve();
              return;
            }

            // Route: POST /retry/:id
            if (req.method === "POST" && path.startsWith("/retry/")) {
              const id = path.replace("/retry/", "");
              await handleRetryQueueItem(req, res, requestId, id);
              resolve();
              return;
            }

            // Route: DELETE /queue/:id
            if (req.method === "DELETE" && path.startsWith("/queue/")) {
              const id = path.replace("/queue/", "");
              await handleDeleteQueueItem(req, res, requestId, id);
              resolve();
              return;
            }

            // Route: PUT /config/stop-list
            if (req.method === "PUT" && path === "/config/stop-list") {
              await handleUpdateStopList(req, res, requestId);
              resolve();
              return;
            }

            // Route: PUT /config/ai-settings
            if (req.method === "PUT" && path === "/config/ai-settings") {
              await handleUpdateAISettings(req, res, requestId);
              resolve();
              return;
            }

            // Route: PUT /config/queue-settings
            if (req.method === "PUT" && path === "/config/queue-settings") {
              await handleUpdateQueueSettings(req, res, requestId);
              resolve();
              return;
            }
          }

          // No matching route found
          logger.warning("Unknown route", {
            requestId,
            method: req.method,
            path,
          });

          sendNotFoundError(res, "Route", { logger, requestId });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error) {
    logger.error("Unexpected error in job queue handler", {
      error,
      requestId,
    });

    sendInternalError(


      res,


      "An unexpected error occurred",


      undefined,


      { logger, requestId: requestId }


    );
  }
};

// Export Cloud Function with 2nd gen runtime options
export const manageJobQueue = functions.https.onRequest(
  {
    region: 'us-central1',
    memory: '512MiB',
    maxInstances: 10,
    timeoutSeconds: 300,
    serviceAccount: 'firebase-admin@static-sites-257923.iam.gserviceaccount.com',
  },
  handleJobQueueRequest
);
