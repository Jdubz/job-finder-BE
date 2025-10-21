/**
 * Shared Logger Utility
 *
 * Simple logger for cloud functions that automatically suppresses logs in test environments.
 * Provides consistent logging across all functions with automatic PII redaction.
 *
 * MIGRATION NOTE: This file now delegates to cloud-logger.ts which uses Google Cloud Logging
 * with structured JSON logs. The SimpleLogger interface is maintained for backward compatibility.
 *
 * For new code, prefer using createCloudLogger() from './cloud-logger' directly for full
 * structured logging capabilities.
 */

import type { SimpleLogger } from "../types/logger.types"
import { createLegacyLogger } from "./cloud-logger"

export type Logger = SimpleLogger

/**
 * Check if we're in a test environment
 */
const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined

/**
 * List of field names that contain sensitive data
 * These will be automatically redacted from logs
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "apikey",
  "api_key",
  "secret",
  "authorization",
  "auth",
  "bearer",
  "cookie",
  "session",
  // PII fields
  "email",
  "phone",
  "phonenumber",
  "phone_number",
  "ssn",
  "creditcard",
  "credit_card",
  "cvv",
  // Firebase-specific sensitive fields
  "idtoken",
  "id_token",
  "refreshtoken",
  "refresh_token",
]

/**
 * Redacts sensitive data from objects for safe logging
 *
 * @param data - Data to redact (can be object, array, primitive)
 * @returns Redacted copy of the data
 */
export const redactSensitiveData = (data: unknown): unknown => {
  // Handle primitives
  if (data === null || data === undefined) {
    return data
  }

  if (typeof data !== "object") {
    return data
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item))
  }

  // Handle objects
  const redacted: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase().replace(/[_-]/g, "")

    // Check if field name contains sensitive keywords
    const isSensitive = SENSITIVE_FIELDS.some((field) => keyLower.includes(field))

    if (isSensitive) {
      // Redact but show data type and length for debugging
      if (typeof value === "string") {
        redacted[key] = `[REDACTED_STRING:${value.length}]`
      } else if (typeof value === "number") {
        redacted[key] = "[REDACTED_NUMBER]"
      } else {
        redacted[key] = "[REDACTED]"
      }
    } else if (typeof value === "object" && value !== null) {
      // Recursively redact nested objects
      redacted[key] = redactSensitiveData(value)
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

/**
 * Create a logger instance
 *
 * Now delegates to Google Cloud Logging with structured JSON logs.
 * In test environment: Uses console-based logging with JSON output.
 * In production: Writes to Google Cloud Logging.
 *
 * @returns Logger instance with info, warning, error methods
 */
export const createLogger = (): Logger => createLegacyLogger()

/**
 * Create a default logger instance (for services)
 *
 * This is an alias for createLogger() - both now use Google Cloud Logging.
 *
 * @returns SimpleLogger instance
 */
export const createDefaultLogger = (): SimpleLogger => createLegacyLogger()

/**
 * Default logger instance
 * Use this in most cases - includes automatic PII redaction and structured logging
 */
export const logger = createLogger()

/**
 * Export Cloud Logging utilities for structured logging
 *
 * For new code that needs full structured logging capabilities,
 * import these from './cloud-logger' or use them via this re-export:
 *
 * ```typescript
 * import { createCloudLogger } from './utils/logger'
 *
 * const logger = createCloudLogger()
 * logger.info({
 *   category: 'api',
 *   action: 'completed',
 *   message: 'User submitted job',
 *   requestId: req.requestId,
 *   userId: req.user?.uid,
 *   http: {
 *     method: req.method,
 *     path: req.path,
 *     statusCode: 200,
 *     duration: Date.now() - startTime
 *   }
 * })
 * ```
 */
export { createCloudLogger, getDefaultLogger as getCloudLogger, type CloudLogger } from "./cloud-logger"
