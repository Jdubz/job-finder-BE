import rateLimit from "express-rate-limit"
import type { Request } from "express"
import { logger } from "../utils/logger"

/**
 * Rate limiting middleware for job-finder Cloud Functions
 *
 * Prevents abuse by limiting the number of requests from a single IP address.
 *
 * Different limits for different function types:
 * - Generator functions: Conservative limits (AI operations are expensive)
 * - Job queue operations: Moderate limits (user-driven actions)
 * - Content items: Moderate limits (CRUD operations)
 */

const isProduction = process.env.NODE_ENV === "production"
const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined

/**
 * Extract IP address from request, handling Firebase Cloud Functions format
 * Firebase Cloud Functions uses X-Forwarded-For header
 */
function getClientIp(req: Request): string {
  // For Firebase Cloud Functions, check X-Forwarded-For first
  const forwardedFor = req.headers["x-forwarded-for"]
  if (forwardedFor) {
    // X-Forwarded-For can be a comma-separated list, take the first one (client IP)
    const ips = typeof forwardedFor === "string" ? forwardedFor.split(",") : forwardedFor
    return ips[0].trim()
  }

  // Fallback to req.ip (standard Express)
  if (req.ip) {
    return req.ip
  }

  // Last resort: use a placeholder for local/test environments
  return "unknown"
}

/**
 * Rate limiter for generator functions (AI document generation)
 * Very conservative - AI operations are expensive
 *
 * Limits: 5 requests per 15 minutes (production), 10 requests (dev)
 */
export const generatorRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 5 : 10,
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    errorCode: "GEN_SEC_001",
    message: "Too many AI generation requests. Please try again later.",
  },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTestEnvironment,
  keyGenerator: (req) => getClientIp(req),
  handler: (req, res) => {
    logger.warning("[RateLimit] Generator rate limit exceeded", {
      ip: getClientIp(req),
      path: req.path,
    })

    res.status(429).json({
      success: false,
      error: "RATE_LIMIT_EXCEEDED",
      errorCode: "GEN_SEC_001",
      message: "Too many AI generation requests from this IP. Please try again in 15 minutes.",
    })
  },
})

/**
 * Rate limiter for job queue operations
 * Moderate limits - users actively managing their job queue
 *
 * Limits: 30 requests per 15 minutes (production), 50 requests (dev)
 */
export const jobQueueRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 30 : 50,
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    errorCode: "JQ_SEC_001",
    message: "Too many job queue requests. Please try again later.",
  },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTestEnvironment,
  keyGenerator: (req) => getClientIp(req),
  handler: (req, res) => {
    logger.warning("[RateLimit] Job queue rate limit exceeded", {
      ip: getClientIp(req),
      path: req.path,
    })

    res.status(429).json({
      success: false,
      error: "RATE_LIMIT_EXCEEDED",
      errorCode: "JQ_SEC_001",
      message: "Too many job queue requests from this IP. Please try again in 15 minutes.",
    })
  },
})

/**
 * Rate limiter for content items CRUD operations
 * Moderate limits - users managing their resume content
 *
 * Limits: 50 requests per 15 minutes (production), 100 requests (dev)
 */
export const contentItemsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 50 : 100,
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    errorCode: "CONT_SEC_001",
    message: "Too many content requests. Please try again later.",
  },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTestEnvironment,
  keyGenerator: (req) => getClientIp(req),
  handler: (req, res) => {
    logger.warning("[RateLimit] Content items rate limit exceeded", {
      ip: getClientIp(req),
      path: req.path,
    })

    res.status(429).json({
      success: false,
      error: "RATE_LIMIT_EXCEEDED",
      errorCode: "CONT_SEC_001",
      message: "Too many content requests from this IP. Please try again in 15 minutes.",
    })
  },
})

/**
 * Strict rate limiter for detected suspicious activity
 * Can be applied conditionally based on suspicious patterns
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1, // Only 1 request per hour
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    errorCode: "APP_SEC_003",
    message: "Access temporarily restricted. Please contact support if you believe this is an error.",
  },
  skip: () => isTestEnvironment,
  keyGenerator: (req) => getClientIp(req),
  handler: (req, res) => {
    logger.warning("[RateLimit] Strict rate limit applied", {
      ip: getClientIp(req),
      path: req.path,
      reason: "suspicious_activity",
    })

    res.status(429).json({
      success: false,
      error: "ACCESS_RESTRICTED",
      errorCode: "APP_SEC_003",
      message: "Access temporarily restricted due to suspicious activity.",
    })
  },
})
