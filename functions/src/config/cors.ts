/**
 * CORS Configuration
 *
 * Centralized CORS configuration for all job-finder Cloud Functions.
 * Allows requests from production, staging, and local development environments.
 */

import cors from "cors"

/**
 * Allowed origins for CORS
 */
export const ALLOWED_ORIGINS = [
  "https://job-finder.joshwentworth.com",
  "https://staging.job-finder.joshwentworth.com",
  "http://localhost:5173", // Vite dev server
  "http://localhost:3000",
]

/**
 * Default CORS options for most functions
 */
export const DEFAULT_CORS_OPTIONS: cors.CorsOptions = {
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Firebase-AppCheck"],
  credentials: true,
}

/**
 * CORS options for generator functions (AI document generation)
 */
export const GENERATOR_CORS_OPTIONS: cors.CorsOptions = {
  ...DEFAULT_CORS_OPTIONS,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
}

/**
 * CORS options for content items API
 */
export const CONTENT_ITEMS_CORS_OPTIONS: cors.CorsOptions = {
  ...DEFAULT_CORS_OPTIONS,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}

/**
 * CORS options for job queue API
 */
export const JOB_QUEUE_CORS_OPTIONS: cors.CorsOptions = {
  ...DEFAULT_CORS_OPTIONS,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}

/**
 * Default CORS handler (use this in most cases)
 */
export const corsHandler = cors(DEFAULT_CORS_OPTIONS)

/**
 * Generator CORS handler
 */
export const generatorCorsHandler = cors(GENERATOR_CORS_OPTIONS)

/**
 * Content items CORS handler
 */
export const contentItemsCorsHandler = cors(CONTENT_ITEMS_CORS_OPTIONS)

/**
 * Job queue CORS handler
 */
export const jobQueueCorsHandler = cors(JOB_QUEUE_CORS_OPTIONS)
