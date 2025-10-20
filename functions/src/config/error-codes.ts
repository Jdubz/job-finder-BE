/**
 * Error Codes Configuration
 *
 * Centralized error code definitions for all Cloud Functions.
 * Each function has its own prefix:
 * - GEN_* = Generator
 * - CONT_* = Content Items
 * - EXP_* = Experience
 * - JQ_* = Job Queue
 * - RES_* = Resume
 *
 * Error code structure: {PREFIX}_{CATEGORY}_{NUMBER}
 * Categories: VAL (validation), REQ (request), DB (database), SYS (system), AUTH (authentication), etc.
 */

export type ErrorCode = {
  code: string
  status: number
  message: string
}

/**
 * Generator API Error Codes (GEN_*)
 */
export const GENERATOR_ERROR_CODES = {
  // Client errors (4xx)
  VALIDATION_FAILED: { code: "GEN_VAL_001", status: 400, message: "Validation failed" },
  UNAUTHORIZED: { code: "GEN_AUTH_001", status: 401, message: "Authentication required" },
  FORBIDDEN: { code: "GEN_AUTH_002", status: 403, message: "Access denied" },
  NOT_FOUND: { code: "GEN_REQ_001", status: 404, message: "Resource not found" },
  METHOD_NOT_ALLOWED: { code: "GEN_REQ_002", status: 405, message: "Method not allowed" },

  // Server errors (5xx)
  GEMINI_ERROR: { code: "GEN_AI_001", status: 503, message: "Gemini AI service error" },
  OPENAI_ERROR: { code: "GEN_AI_002", status: 503, message: "OpenAI service error" },
  PDF_GENERATION_ERROR: { code: "GEN_PDF_001", status: 500, message: "PDF generation failed" },
  FIRESTORE_ERROR: { code: "GEN_DB_001", status: 503, message: "Database error" },
  INTERNAL_ERROR: { code: "GEN_SYS_001", status: 500, message: "Internal server error" },
} as const

/**
 * Content Items API Error Codes (CONT_*)
 */
export const CONTENT_ITEMS_ERROR_CODES = {
  // Client errors (4xx)
  VALIDATION_FAILED: { code: "CONT_VAL_001", status: 400, message: "Validation failed" },
  UNAUTHORIZED: { code: "CONT_AUTH_001", status: 401, message: "Authentication required" },
  FORBIDDEN: { code: "CONT_AUTH_002", status: 403, message: "Access denied - not content owner" },
  NOT_FOUND: { code: "CONT_REQ_001", status: 404, message: "Content item not found" },
  METHOD_NOT_ALLOWED: { code: "CONT_REQ_002", status: 405, message: "Method not allowed" },

  // Server errors (5xx)
  FIRESTORE_ERROR: { code: "CONT_DB_001", status: 503, message: "Database error" },
  INTERNAL_ERROR: { code: "CONT_SYS_001", status: 500, message: "Internal server error" },
} as const

/**
 * Experience API Error Codes (EXP_*)
 */
export const EXPERIENCE_ERROR_CODES = {
  // Client errors (400, 404, 405)
  VALIDATION_FAILED: { code: "EXP_VAL_001", status: 400, message: "Validation failed" },
  INVALID_DATE: { code: "EXP_VAL_002", status: 400, message: "Invalid date format (expected YYYY-MM)" },
  MISSING_TITLE: { code: "EXP_VAL_003", status: 400, message: "Title is required" },
  MISSING_START_DATE: { code: "EXP_VAL_004", status: 400, message: "Start date is required" },
  UNAUTHORIZED: { code: "EXP_AUTH_001", status: 401, message: "Authentication required" },
  FORBIDDEN: { code: "EXP_AUTH_002", status: 403, message: "Access denied - not experience owner" },
  NOT_FOUND: { code: "EXP_REQ_001", status: 404, message: "Experience entry not found" },
  METHOD_NOT_ALLOWED: { code: "EXP_REQ_002", status: 405, message: "Method not allowed" },

  // Server errors (5xx)
  FIRESTORE_ERROR: { code: "EXP_DB_001", status: 503, message: "Database error" },
  INTERNAL_ERROR: { code: "EXP_SYS_001", status: 500, message: "Internal server error" },
} as const

/**
 * Job Queue Error Codes (JQ_*)
 */
export const JOB_QUEUE_ERROR_CODES = {
  // Client errors (4xx)
  VALIDATION_FAILED: { code: "JQ_VAL_001", status: 400, message: "Validation failed" },
  INVALID_URL: { code: "JQ_VAL_002", status: 400, message: "Invalid URL format" },
  UNAUTHORIZED: { code: "JQ_AUTH_001", status: 401, message: "Authentication required" },
  DUPLICATE_JOB: { code: "JQ_DUP_001", status: 409, message: "Job already exists in queue" },
  ALREADY_ANALYZED: { code: "JQ_DUP_002", status: 409, message: "Job already analyzed" },
  STOP_LIST_MATCH: { code: "JQ_STOP_001", status: 400, message: "Job matches exclusion criteria" },
  NOT_FOUND: { code: "JQ_REQ_001", status: 404, message: "Queue item not found" },
  FORBIDDEN: { code: "JQ_REQ_002", status: 403, message: "Access denied - not queue item owner" },
  METHOD_NOT_ALLOWED: { code: "JQ_REQ_003", status: 405, message: "Method not allowed" },

  // Server errors (5xx)
  FIRESTORE_ERROR: { code: "JQ_DB_001", status: 503, message: "Database error" },
  INTERNAL_ERROR: { code: "JQ_SYS_001", status: 500, message: "Internal server error" },
} as const

/**
 * Resume Upload Error Codes (RES_*)
 */
export const RESUME_ERROR_CODES = {
  // Client errors (400, 405, 413)
  VALIDATION_FAILED: { code: "RES_VAL_001", status: 400, message: "Validation failed" },
  INVALID_FILE_TYPE: { code: "RES_VAL_002", status: 400, message: "Only PDF files are allowed" },
  FILE_TOO_LARGE: { code: "RES_VAL_003", status: 413, message: "File size must be less than 10MB" },
  NO_FILE_PROVIDED: { code: "RES_VAL_004", status: 400, message: "No file provided" },
  UNAUTHORIZED: { code: "RES_AUTH_001", status: 401, message: "Authentication required" },
  METHOD_NOT_ALLOWED: { code: "RES_REQ_001", status: 405, message: "Method not allowed" },

  // Server errors (5xx)
  STORAGE_ERROR: { code: "RES_STOR_001", status: 503, message: "Storage service error" },
  INTERNAL_ERROR: { code: "RES_SYS_001", status: 500, message: "Internal server error" },
} as const
