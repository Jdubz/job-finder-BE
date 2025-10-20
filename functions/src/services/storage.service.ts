/**
 * Storage Service
 *
 * Handles Google Cloud Storage uploads and public URL generation for generated documents.
 *
 * Environment-aware bucket selection:
 * - Local/Development: Uses Firebase Storage Emulator (127.0.0.1:9199)
 * - Staging: job-finder-documents-staging (publicly readable)
 * - Production: job-finder-documents (publicly readable)
 *
 * **PUBLIC ACCESS:** Buckets are configured with public read access, so URLs
 * never expire. Anyone with a URL can download the file, but URLs are
 * long/random and contain job application materials (not sensitive data).
 */

import { Storage } from "@google-cloud/storage"
import type { SimpleLogger } from "../types/logger.types"
import { createDefaultLogger } from "../utils/logger"

export interface UploadResult {
  gcsPath: string
  filename: string
  size: number
  storageClass: "STANDARD" | "COLDLINE"
}

export class StorageService {
  private storage: Storage
  private bucketName: string
  private logger: SimpleLogger
  private useEmulator: boolean

  constructor(bucketName?: string, logger?: SimpleLogger) {
    this.logger = logger || createDefaultLogger()

    // Detect emulator ONLY via FUNCTIONS_EMULATOR env var
    this.useEmulator = process.env.FUNCTIONS_EMULATOR === "true"

    // Determine bucket name based on environment
    if (bucketName) {
      this.bucketName = bucketName
    } else if (this.useEmulator) {
      this.bucketName = "demo-job-finder-documents"
    } else {
      const environment = process.env.ENVIRONMENT || "production"
      this.bucketName =
        environment === "staging" ? "job-finder-documents-staging" : "job-finder-documents"
    }

    // Initialize Storage client
    if (this.useEmulator) {
      this.logger.info("[Storage] Using Firebase Storage Emulator", {
        bucket: this.bucketName,
      })

      this.storage = new Storage({
        apiEndpoint: "http://127.0.0.1:9199",
        projectId: "demo-project",
      })
    } else {
      this.logger.info("[Storage] Using GCS", {
        bucket: this.bucketName,
        environment: process.env.ENVIRONMENT,
      })

      this.storage = new Storage()
    }
  }

  /**
   * Upload a PDF buffer to GCS
   */
  async uploadPDF(
    buffer: Buffer,
    filename: string,
    documentType: "resume" | "cover-letter"
  ): Promise<UploadResult> {
    try {
      // Generate GCS path with date-based organization
      const date = new Date().toISOString().split("T")[0] // YYYY-MM-DD
      const folder = documentType === "resume" ? "resumes" : "cover-letters"
      const gcsPath = `${folder}/${date}/${filename}`

      this.logger.info(`Uploading ${documentType} to GCS`, {
        gcsPath,
        size: buffer.length,
      })

      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(gcsPath)

      await file.save(buffer, {
        contentType: "application/pdf",
        metadata: {
          cacheControl: "public, max-age=31536000", // 1 year cache
          metadata: {
            documentType,
            uploadedAt: new Date().toISOString(),
          },
        },
        public: true, // Make publicly readable
      })

      // Set storage class based on document type
      // Resumes are accessed more frequently, so use STANDARD
      // Cover letters are accessed less, so we could use COLDLINE for cost savings
      const storageClass = documentType === "resume" ? "STANDARD" : "STANDARD"

      this.logger.info(`${documentType} uploaded successfully`, {
        gcsPath,
        size: buffer.length,
        storageClass,
      })

      return {
        gcsPath,
        filename,
        size: buffer.length,
        storageClass,
      }
    } catch (error) {
      this.logger.error(`Failed to upload ${documentType} to GCS`, {
        error,
        filename,
      })
      throw new Error(`Storage upload failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Upload an image buffer to GCS (avatar or logo)
   */
  async uploadImage(
    buffer: Buffer,
    filename: string,
    imageType: "avatar" | "logo",
    contentType: string
  ): Promise<UploadResult> {
    try {
      const folder = imageType === "avatar" ? "images/avatars" : "images/logos"
      const gcsPath = `${folder}/${filename}`

      this.logger.info(`Uploading ${imageType} to GCS`, {
        gcsPath,
        size: buffer.length,
        contentType,
      })

      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(gcsPath)

      await file.save(buffer, {
        contentType,
        metadata: {
          cacheControl: "public, max-age=31536000", // 1 year cache
          metadata: {
            imageType,
            uploadedAt: new Date().toISOString(),
          },
        },
        public: true,
      })

      this.logger.info(`${imageType} uploaded successfully`, {
        gcsPath,
        size: buffer.length,
      })

      return {
        gcsPath,
        filename,
        size: buffer.length,
        storageClass: "STANDARD",
      }
    } catch (error) {
      this.logger.error(`Failed to upload ${imageType} to GCS`, {
        error,
        filename,
      })
      throw new Error(`Image upload failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Generate a public URL for viewing/downloading a file
   *
   * Since buckets are configured as publicly readable, we return direct HTTPS URLs
   * that never expire.
   *
   * @param gcsPath - Full GCS path (e.g., "resumes/YYYY-MM-DD/filename.pdf")
   * @returns A permanent public HTTPS URL to the file
   */
  async generatePublicUrl(gcsPath: string): Promise<string> {
    try {
      if (this.useEmulator) {
        // Emulator URL format
        return `http://127.0.0.1:9199/v0/b/${this.bucketName}/o/${encodeURIComponent(gcsPath)}?alt=media`
      }

      // Production GCS public URL format
      // Format: https://storage.googleapis.com/{bucket}/{path}
      return `https://storage.googleapis.com/${this.bucketName}/${encodeURIComponent(gcsPath)}`
    } catch (error) {
      this.logger.error("Failed to generate public URL", {
        error,
        gcsPath,
      })
      throw error
    }
  }

  /**
   * Generate public URLs for both resume and cover letter
   * Returns direct HTTPS URLs that never expire (buckets are publicly readable)
   */
  async generatePublicUrls(
    resumePath: string | null,
    coverLetterPath: string | null
  ): Promise<{
    resumeUrl?: string
    coverLetterUrl?: string
  }> {
    const urls: { resumeUrl?: string; coverLetterUrl?: string } = {}

    if (resumePath) {
      urls.resumeUrl = await this.generatePublicUrl(resumePath)
    }

    if (coverLetterPath) {
      urls.coverLetterUrl = await this.generatePublicUrl(coverLetterPath)
    }

    return urls
  }

  /**
   * Check if a file exists in GCS
   */
  async fileExists(gcsPath: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(gcsPath)
      const [exists] = await file.exists()
      return exists
    } catch (error) {
      this.logger.error("Failed to check file existence", {
        error,
        gcsPath,
      })
      return false
    }
  }

  /**
   * Delete a file from GCS
   */
  async deleteFile(gcsPath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(gcsPath)

      await file.delete()

      this.logger.info("File deleted from GCS", { gcsPath })
    } catch (error) {
      this.logger.error("Failed to delete file from GCS", {
        error,
        gcsPath,
      })
      throw new Error(`File deletion failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(gcsPath: string): Promise<{
    size: number
    contentType: string
    created: Date
    updated: Date
  } | null> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(gcsPath)

      const [metadata] = await file.getMetadata()

      return {
        size: typeof metadata.size === "number" ? metadata.size : parseInt(metadata.size || "0", 10),
        contentType: metadata.contentType || "application/octet-stream",
        created: new Date(metadata.timeCreated || Date.now()),
        updated: new Date(metadata.updated || Date.now()),
      }
    } catch (error) {
      this.logger.error("Failed to get file metadata", {
        error,
        gcsPath,
      })
      return null
    }
  }
}

/**
 * Helper function to create a Storage service instance
 */
export function createStorageService(bucketName?: string, logger?: SimpleLogger): StorageService {
  return new StorageService(bucketName, logger)
}
