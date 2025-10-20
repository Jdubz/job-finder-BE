import { https } from "firebase-functions/v2"
import type { Request as ExpressRequest, Response } from "express"
import { Storage } from "@google-cloud/storage"
import busboy from "busboy"
import { verifyAuthenticatedEditor, type AuthenticatedRequest } from "./middleware/auth.middleware"
import { logger } from "./utils/logger"
import { generateRequestId } from "./utils/request-id"
import { resumeUploadCorsHandler } from "./config/cors"
import { RESUME_ERROR_CODES as ERROR_CODES } from "./config/error-codes"
import { PACKAGE_VERSION } from "./config/versions"

// Extend Express Request to include rawBody from Firebase Functions
type Request = ExpressRequest & { rawBody?: Buffer }

// Initialize Google Cloud Storage
const storage = new Storage()
const BUCKET_NAME = "joshwentworth-resume"
const RESUME_FILENAME = "resume.pdf"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Cloud Function to handle resume uploads
 *
 * Routes:
 * - POST /resume/upload - Upload resume (auth required, PDF only, replaces existing)
 */
const handleResumeRequest = async (req: Request, res: Response): Promise<void> => {
  const requestId = generateRequestId()

  // Apply CORS middleware (must be before any auth checks)
  await new Promise<void>((resolve, reject) => {
    resumeUploadCorsHandler(req, res, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })

  // Handle OPTIONS preflight (must be before any auth checks)
  if (req.method === "OPTIONS") {
    res.status(204).send("")
    return
  }

  // Health check endpoint (no auth required)
  if (req.method === "GET" && (req.path === "/health" || req.url === "/health")) {
    res.status(200).json({
      success: true,
      service: "uploadResume",
      status: "healthy",
      version: PACKAGE_VERSION,
      timestamp: new Date().toISOString(),
    })
    return
  }

  try {

    // Only allow POST requests
    if (req.method !== "POST") {
      logger.warning("Method not allowed", { method: req.method, requestId })
      const err = ERROR_CODES.METHOD_NOT_ALLOWED
      res.status(err.status).json({
        success: false,
        error: "METHOD_NOT_ALLOWED",
        errorCode: err.code,
        message: err.message,
        requestId,
      })
      return
    }

    // Apply auth middleware
    await new Promise<void>((resolveAuth, rejectAuth) => {
      verifyAuthenticatedEditor(logger)(req as AuthenticatedRequest, res, (err) => {
        if (err) rejectAuth(err)
        else resolveAuth()
      })
    })

    // Handle file upload
    await handleResumeUpload(req as AuthenticatedRequest, res, requestId)
  } catch (error) {
    logger.error("Unexpected error in resume handler", {
      error,
      requestId,
      method: req.method,
      url: req.url,
    })

    const err = ERROR_CODES.INTERNAL_ERROR
    res.status(err.status).json({
      success: false,
      error: "INTERNAL_ERROR",
      errorCode: err.code,
      message: err.message,
      requestId,
    })
  }
}

/**
 * POST /resume/upload - Upload resume (auth required)
 */
async function handleResumeUpload(
  req: AuthenticatedRequest & { rawBody?: Buffer },
  res: Response,
  requestId: string
): Promise<void> {
  const userEmail = req.user!.email

  logger.info("Processing resume upload", {
    requestId,
    userEmail,
  })

  try {
    const contentType = req.headers["content-type"]
    if (!contentType || !contentType.includes("multipart/form-data")) {
      const err = ERROR_CODES.VALIDATION_FAILED
      res.status(err.status).json({
        success: false,
        error: "VALIDATION_FAILED",
        errorCode: err.code,
        message: "Content-Type must be multipart/form-data",
        requestId,
      })
      return
    }

    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1 // Only allow one file
      }
    })
    let fileUploaded = false
    let uploadError: Error | null = null
    let responseHandled = false
    let uploadInProgress = false

    bb.on("error", (err: unknown) => {
      logger.error("Busboy error", { error: err, requestId })
      uploadError = err instanceof Error ? err : new Error(String(err))

      // Handle the error immediately if response not already sent
      if (!responseHandled && !res.headersSent) {
        responseHandled = true
        const error = ERROR_CODES.VALIDATION_FAILED
        const errorMessage = err instanceof Error ? err.message : String(err)
        res.status(error.status).json({
          success: false,
          error: "VALIDATION_FAILED",
          errorCode: error.code,
          message: errorMessage || error.message,
          requestId,
        })
      }
    })

    bb.on("file", (fieldname, file, info) => {
      const { filename, mimeType } = info

      // Mark that we're processing a file
      uploadInProgress = true

      // Validate file type
      if (mimeType !== "application/pdf") {
        uploadError = new Error("INVALID_FILE_TYPE")
        uploadInProgress = false
        file.resume() // Drain the stream
        return
      }

      // Upload to GCS
      const bucket = storage.bucket(BUCKET_NAME)
      const blob = bucket.file(RESUME_FILENAME)
      const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: {
          contentType: "application/pdf",
          metadata: {
            uploadedBy: userEmail,
            uploadedAt: new Date().toISOString(),
            originalFilename: filename,
          },
        },
      })

      blobStream.on("error", (err) => {
        logger.error("Upload stream error", { error: err, requestId })
        uploadError = err
        uploadInProgress = false
      })

      blobStream.on("finish", () => {
        fileUploaded = true
        uploadInProgress = false

        // Send response immediately after upload completes
        if (!responseHandled && !res.headersSent) {
          responseHandled = true
          const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${RESUME_FILENAME}`

          logger.info("Resume uploaded successfully", {
            requestId,
            filename,
            userEmail,
          })

          res.status(200).json({
            success: true,
            message: "Resume uploaded successfully",
            url: publicUrl,
            requestId,
          })
        }
      })

      file.on("limit", () => {
        uploadError = new Error("FILE_TOO_LARGE")
        uploadInProgress = false
        file.resume() // Drain the stream
      })

      file.pipe(blobStream)
    })

    bb.on("finish", () => {
      // Skip if response already handled (success case is handled in blobStream.on("finish"))
      if (responseHandled) {
        return
      }

      // If upload is still in progress, wait for blobStream to finish
      if (uploadInProgress) {
        return
      }

      // Only handle error cases here
      responseHandled = true

      if (uploadError) {
        const errorType = uploadError.message
        const err =
          errorType === "INVALID_FILE_TYPE"
            ? ERROR_CODES.INVALID_FILE_TYPE
            : errorType === "FILE_TOO_LARGE"
              ? ERROR_CODES.FILE_TOO_LARGE
              : ERROR_CODES.STORAGE_ERROR

        logger.warning("Upload failed", { error: errorType, requestId })
        res.status(err.status).json({
          success: false,
          error: errorType,
          errorCode: err.code,
          message: err.message,
          requestId,
        })
        return
      }

      if (!fileUploaded) {
        const err = ERROR_CODES.NO_FILE_PROVIDED
        logger.warning("No file provided", { requestId })
        res.status(err.status).json({
          success: false,
          error: "NO_FILE_PROVIDED",
          errorCode: err.code,
          message: err.message,
          requestId,
        })
        return
      }
    })

    // Firebase Functions v2 buffers the request body into req.rawBody
    // We need to feed this buffer to busboy instead of piping the request stream
    const rawBody = req.rawBody
    if (rawBody) {
      bb.end(rawBody)
    } else {
      // Fallback: stream directly from request (shouldn't happen with Firebase Functions v2)
      req.on("error", (err) => {
        logger.error("Request stream error", { error: err, requestId })
        if (!responseHandled && !res.headersSent) {
          responseHandled = true
          const error = ERROR_CODES.VALIDATION_FAILED
          res.status(error.status).json({
            success: false,
            error: "VALIDATION_FAILED",
            errorCode: error.code,
            message: "Error reading request data",
            requestId,
          })
        }
      })
      req.pipe(bb)
    }
  } catch (error) {
    logger.error("Failed to upload resume", {
      error,
      requestId,
      userEmail,
    })

    const err = ERROR_CODES.STORAGE_ERROR
    res.status(err.status).json({
      success: false,
      error: "STORAGE_ERROR",
      errorCode: err.code,
      message: err.message,
      requestId,
    })
  }
}

/**
 * Export as Firebase HTTP Function (v2)
 *
 * Authorization: Uses Firebase Auth custom claims (role: 'editor')
 */
export const uploadResume = https.onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    maxInstances: 5,
    timeoutSeconds: 60,
    serviceAccount: "cloud-functions-builder@static-sites-257923.iam.gserviceaccount.com",
  },
  handleResumeRequest
)
