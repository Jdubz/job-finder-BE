import { Request, Response, NextFunction } from "express"
import * as admin from "firebase-admin"
import { logger } from "../utils/logger"

/**
 * Authentication middleware for Cloud Functions
 *
 * Verifies Firebase Authentication tokens and attaches user information to the request.
 * All authenticated endpoints should use this middleware.
 */

const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined

// Extend Express Request type to include user information
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        uid: string
        email?: string
        emailVerified?: boolean
      }
    }
  }
}

/**
 * Verify Firebase Authentication token middleware
 *
 * Extracts and verifies Firebase ID token from Authorization header.
 * Token must be in the format: "Bearer <token>"
 */
export const verifyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip verification in test environment only
  if (isTestEnvironment) {
    // In tests, allow a mock user to be set
    req.user = {
      uid: "test-user-id",
      email: "test@example.com",
      emailVerified: true,
    }
    return next()
  }

  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warning("[Auth] Missing or invalid Authorization header")
      res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        errorCode: "AUTH_001",
        message: "Authentication required. Please provide a valid token.",
      })
      return
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.split("Bearer ")[1]

    if (!token) {
      logger.warning("[Auth] Empty token")
      res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        errorCode: "AUTH_002",
        message: "Authentication token is empty.",
      })
      return
    }

    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(token)

    // Attach user information to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified || false,
    }

    logger.info("[Auth] Token verified successfully", {
      uid: req.user.uid,
      email: req.user.email,
    })

    next()
  } catch (error) {
    logger.error("[Auth] Token verification failed", {
      error: error instanceof Error ? error.message : error,
    })

    // Determine specific error type
    if (error instanceof Error) {
      if (error.message.includes("expired")) {
        res.status(401).json({
          success: false,
          error: "TOKEN_EXPIRED",
          errorCode: "AUTH_003",
          message: "Authentication token has expired. Please sign in again.",
        })
        return
      }

      if (error.message.includes("revoked")) {
        res.status(401).json({
          success: false,
          error: "TOKEN_REVOKED",
          errorCode: "AUTH_004",
          message: "Authentication token has been revoked. Please sign in again.",
        })
        return
      }
    }

    // Generic invalid token error
    res.status(401).json({
      success: false,
      error: "INVALID_TOKEN",
      errorCode: "AUTH_005",
      message: "Invalid authentication token.",
    })
  }
}

/**
 * Optional authentication middleware
 *
 * Similar to verifyAuth, but doesn't fail if no token is provided.
 * Useful for endpoints that have different behavior for authenticated vs anonymous users.
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (isTestEnvironment) {
    return next()
  }

  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // No auth header - continue as anonymous
      return next()
    }

    const token = authHeader.split("Bearer ")[1]

    if (!token) {
      // Empty token - continue as anonymous
      return next()
    }

    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(token)

    // Attach user information to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified || false,
    }

    logger.info("[Auth] Optional auth verified", {
      uid: req.user.uid,
    })

    next()
  } catch (error) {
    // Token verification failed, but this is optional auth
    // Continue as anonymous user
    logger.warning("[Auth] Optional auth verification failed, continuing as anonymous", {
      error: error instanceof Error ? error.message : error,
    })
    next()
  }
}
