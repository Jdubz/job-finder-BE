/**
 * Database configuration constants
 *
 * Centralized configuration for Firestore database settings.
 *
 * Environment-based database selection:
 * - Emulator: (default)
 * - Staging: job-finder-staging
 * - Production: job-finder-production
 */

import { logger } from "../utils/logger"

/**
 * Get the appropriate Firestore database ID based on environment
 *
 * Priority order:
 * 1. FIRESTORE_DATABASE_ID environment variable (explicit override)
 * 2. Emulator detection (uses "(default)")
 * 3. ENVIRONMENT variable (production/staging)
 * 4. NODE_ENV variable (fallback)
 * 5. Default to "job-finder-production" (production)
 *
 * @returns {string} The database ID to use
 */
function getDatabaseId(): string {
  // Explicit override
  if (process.env.FIRESTORE_DATABASE_ID) {
    return process.env.FIRESTORE_DATABASE_ID
  }

  // Emulator detection
  const isEmulator = process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR === "true"
  if (isEmulator) {
    return "(default)"
  }

  // Environment-based selection
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV

  switch (environment) {
    case "staging":
      return "job-finder-staging"
    case "production":
      return "job-finder-production"
    case "development":
    case "test":
      return "(default)"
    default:
      // Production is the safe default
      return "job-finder-production"
  }
}

/**
 * Firestore database ID
 *
 * IMPORTANT: This value is determined at module load time and will not change
 * during function execution. Ensure environment variables are set before import.
 */
export const DATABASE_ID = getDatabaseId()

/**
 * Job queue collection name
 */
export const JOB_QUEUE_COLLECTION = "job-queue"

/**
 * Generator documents collection name
 */
export const GENERATOR_DOCUMENTS_COLLECTION = "generator-documents"

/**
 * Content items collection name (user's resume data)
 */
export const CONTENT_ITEMS_COLLECTION = "content-items"

/**
 * User profiles collection name
 */
export const USER_PROFILES_COLLECTION = "user-profiles"

/**
 * Validate that DATABASE_ID is set correctly
 * This runs at module load time to catch configuration errors early
 */
if (!DATABASE_ID) {
  throw new Error("DATABASE_ID must be set. Check environment configuration.")
}

// Log database configuration (redacted in production)
const isProduction = process.env.ENVIRONMENT === "production" || process.env.NODE_ENV === "production"
if (!isProduction) {
  logger.info(`[Database Config] Using database: ${DATABASE_ID}`)
  logger.info(`[Database Config] Environment: ${process.env.ENVIRONMENT || process.env.NODE_ENV || "unknown"}`)
}
