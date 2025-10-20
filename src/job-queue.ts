/**
 * Job Queue Cloud Function
 * 
 * Manages job queue operations for the Job Finder application.
 * Provides APIs for job submission, queue management, and configuration.
 */

import * as functions from "firebase-functions/v2";
import { Request, Response } from "express";
import Joi from "joi";
import { JobQueueService } from "./services/job-queue.service";
import { verifyAuthenticatedEditor, verifyAuthenticatedUser } from "./middleware/auth.middleware";
import { logger } from "./utils/logger";
import { generateRequestId } from "./utils/request-id";
import { corsHandler } from "./config/cors";
import { JOB_QUEUE_ERROR_CODES } from "./config/error-codes";
import { PACKAGE_VERSION } from "./config/versions";

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
 * Helper function to send error response
 */
function sendError(
  res: Response,
  statusCode: number,
  errorCode: string,
  message: string,
  requestId: string
) {
  res.status(statusCode).json({
    success: false,
    error: errorCode,
    message,
    requestId,
  });
}

/**
 * Helper function to send success response
 */
function sendSuccess(res: Response, data: any, requestId: string) {
  res.status(200).json({
    success: true,
    data,
    requestId,
  });
}

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
      logger.warning("Invalid submit job request", {
        requestId,
        error: error.details,
      });

      sendError(
        res,
        400,
        JOB_QUEUE_ERROR_CODES.VALIDATION_FAILED.code,
        error.details[0].message,
        requestId
      );
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

    logger.info("Job submitted successfully", {
      requestId,
      queueItemId: queueItem.id,
      userId,
    });

    sendSuccess(
      res,
      {
        id: queueItem.id,
        status: queueItem.status,
        message: generationId
          ? "Job submitted with pre-generated documents"
          : "Job submitted successfully",
      },
      requestId
    );
  } catch (error) {
    logger.error("Failed to submit job", { error, requestId });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to submit job",
      requestId
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
      logger.warning("Invalid submit company request", {
        requestId,
        error: error.details,
      });

      sendError(
        res,
        400,
        JOB_QUEUE_ERROR_CODES.VALIDATION_FAILED.code,
        error.details[0].message,
        requestId
      );
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

    logger.info("Company submitted successfully", {
      requestId,
      queueItemId: queueItem.id,
      userId,
    });

    sendSuccess(
      res,
      {
        id: queueItem.id,
        status: queueItem.status,
        message: "Company submitted successfully",
      },
      requestId
    );
  } catch (error) {
    logger.error("Failed to submit company", { error, requestId });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to submit company",
      requestId
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
      logger.warning("Invalid submit scrape request", {
        requestId,
        error: error.details,
      });

      sendError(
        res,
        400,
        JOB_QUEUE_ERROR_CODES.VALIDATION_FAILED.code,
        error.details[0].message,
        requestId
      );
      return;
    }

    const { scrape_config } = value;

    // Get user ID (required for this route)
    const userId = (req as any).user?.uid;

    if (!userId) {
      sendError(res, 401, "UNAUTHORIZED", "Authentication required", requestId);
      return;
    }

    // Check if user already has a pending scrape
    const hasPending = await jobQueueService.hasPendingScrape(userId);

    if (hasPending) {
      logger.warning("User already has pending scrape", {
        requestId,
        userId,
      });

      sendError(
        res,
        429,
        "SCRAPE_IN_PROGRESS",
        "You already have a scrape request in progress",
        requestId
      );
      return;
    }

    // Submit scrape request
    const queueItem = await jobQueueService.submitScrape(userId, scrape_config);

    logger.info("Scrape request submitted successfully", {
      requestId,
      queueItemId: queueItem.id,
      userId,
    });

    sendSuccess(
      res,
      {
        id: queueItem.id,
        status: queueItem.status,
        message: "Scrape request submitted successfully",
      },
      requestId
    );
  } catch (error) {
    logger.error("Failed to submit scrape request", { error, requestId });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to submit scrape request",
      requestId
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
      sendError(res, 401, "UNAUTHORIZED", "Authentication required", requestId);
      return;
    }

    // Check for pending scrape
    const hasPending = await jobQueueService.hasPendingScrape(userId);

    logger.info("Pending scrape check", {
      requestId,
      userId,
      hasPending,
    });

    sendSuccess(
      res,
      {
        hasPendingScrape: hasPending,
      },
      requestId
    );
  } catch (error) {
    logger.error("Failed to check for pending scrape", { error, requestId });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to check for pending scrape",
      requestId
    );
  }
}

/**
 * Handle GET /status/:id - Get queue item status (public)
 */
async function handleGetQueueStatus(
  req: Request,
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

      sendError(res, 404, "NOT_FOUND", "Queue item not found", requestId);
      return;
    }

    logger.info("Queue status retrieved", {
      requestId,
      queueItemId: id,
    });

    sendSuccess(res, queueItem, requestId);
  } catch (error) {
    logger.error("Failed to get queue status", { error, requestId, id });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to get queue status",
      requestId
    );
  }
}

/**
 * Handle GET /stats - Get queue statistics (public)
 */
async function handleGetStats(
  req: Request,
  res: Response,
  requestId: string
) {
  try {
    const stats = await jobQueueService.getQueueStats();

    logger.info("Queue stats retrieved", {
      requestId,
      total: stats.total,
    });

    sendSuccess(res, stats, requestId);
  } catch (error) {
    logger.error("Failed to get queue stats", { error, requestId });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to get queue stats",
      requestId
    );
  }
}

/**
 * Handle GET /config/stop-list - Get stop list (public, read-only)
 */
async function handleGetStopList(
  req: Request,
  res: Response,
  requestId: string
) {
  try {
    const stopList = await jobQueueService.getStopList();

    logger.info("Stop list retrieved", {
      requestId,
      companiesCount: stopList.excludedCompanies.length,
    });

    sendSuccess(res, stopList, requestId);
  } catch (error) {
    logger.error("Failed to get stop list", { error, requestId });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to get stop list",
      requestId
    );
  }
}

/**
 * Handle GET /config/ai-settings - Get AI settings (public, read-only)
 */
async function handleGetAISettings(
  req: Request,
  res: Response,
  requestId: string
) {
  try {
    const settings = await jobQueueService.getAISettings();

    logger.info("AI settings retrieved", {
      requestId,
    });

    sendSuccess(res, settings, requestId);
  } catch (error) {
    logger.error("Failed to get AI settings", { error, requestId });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to get AI settings",
      requestId
    );
  }
}

/**
 * Handle GET /config/queue-settings - Get queue settings (public, read-only)
 */
async function handleGetQueueSettings(
  req: Request,
  res: Response,
  requestId: string
) {
  try {
    const settings = await jobQueueService.getQueueSettings();

    logger.info("Queue settings retrieved", {
      requestId,
    });

    sendSuccess(res, settings, requestId);
  } catch (error) {
    logger.error("Failed to get queue settings", { error, requestId });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to get queue settings",
      requestId
    );
  }
}

/**
 * Handle POST /retry/:id - Retry failed queue item (editor only)
 */
async function handleRetryQueueItem(
  req: Request,
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

    sendSuccess(
      res,
      {
        id,
        message: "Queue item retry initiated",
      },
      requestId
    );
  } catch (error) {
    logger.error("Failed to retry queue item", { error, requestId, id });

    const errorMessage =
      error instanceof Error ? error.message : "Failed to retry queue item";

    sendError(
      res,
      400,
      "RETRY_FAILED",
      errorMessage,
      requestId
    );
  }
}

/**
 * Handle DELETE /queue/:id - Delete queue item (editor only)
 */
async function handleDeleteQueueItem(
  req: Request,
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

    sendSuccess(
      res,
      {
        id,
        message: "Queue item deleted successfully",
      },
      requestId
    );
  } catch (error) {
    logger.error("Failed to delete queue item", { error, requestId, id });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to delete queue item",
      requestId
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

      sendError(
        res,
        400,
        JOB_QUEUE_ERROR_CODES.VALIDATION_FAILED.code,
        error.details[0].message,
        requestId
      );
      return;
    }

    await jobQueueService.updateStopList(value);

    logger.info("Stop list updated", {
      requestId,
      companiesCount: value.excludedCompanies.length,
    });

    sendSuccess(
      res,
      {
        message: "Stop list updated successfully",
      },
      requestId
    );
  } catch (error) {
    logger.error("Failed to update stop list", { error, requestId });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to update stop list",
      requestId
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

      sendError(
        res,
        400,
        JOB_QUEUE_ERROR_CODES.VALIDATION_FAILED.code,
        error.details[0].message,
        requestId
      );
      return;
    }

    await jobQueueService.updateAISettings(value);

    logger.info("AI settings updated", {
      requestId,
    });

    sendSuccess(
      res,
      {
        message: "AI settings updated successfully",
      },
      requestId
    );
  } catch (error) {
    logger.error("Failed to update AI settings", { error, requestId });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to update AI settings",
      requestId
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

      sendError(
        res,
        400,
        JOB_QUEUE_ERROR_CODES.VALIDATION_FAILED.code,
        error.details[0].message,
        requestId
      );
      return;
    }

    await jobQueueService.updateQueueSettings(value);

    logger.info("Queue settings updated", {
      requestId,
    });

    sendSuccess(
      res,
      {
        message: "Queue settings updated successfully",
      },
      requestId
    );
  } catch (error) {
    logger.error("Failed to update queue settings", { error, requestId });

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "Failed to update queue settings",
      requestId
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

          sendError(res, 404, "NOT_FOUND", "Route not found", requestId);
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

    sendError(
      res,
      500,
      JOB_QUEUE_ERROR_CODES.INTERNAL_ERROR.code,
      "An unexpected error occurred",
      requestId
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
  },
  handleJobQueueRequest
);
