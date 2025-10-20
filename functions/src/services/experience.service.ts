/**
 * Experience Service
 *
 * Manages work experience entries for resume generation.
 * Each experience entry represents a job/role with highlights and technologies.
 *
 * Architecture:
 * - User-based ownership (userId field)
 * - Simple CRUD operations
 * - Used by Generator service for resume/cover letter content
 */

import { FieldValue } from "@google-cloud/firestore"
import type { SimpleLogger } from "../types/logger.types"
import { createDefaultLogger } from "../utils/logger"
import { createFirestoreInstance } from "../config/firestore"
import type { ExperienceEntry } from "@jsdubzw/job-finder-shared-types"

const COLLECTION_NAME = "experiences"

/**
 * Data for creating a new experience entry
 */
export interface CreateExperienceData {
  company: string
  role: string
  location?: string
  startDate: string // YYYY-MM format
  endDate: string | null // YYYY-MM format or null for current
  highlights: string[]
  technologies?: string[]
}

/**
 * Data for updating an experience entry
 */
export interface UpdateExperienceData {
  company?: string
  role?: string
  location?: string
  startDate?: string
  endDate?: string | null
  highlights?: string[]
  technologies?: string[]
}

export class ExperienceService {
  private db: FirebaseFirestore.Firestore
  private logger: SimpleLogger
  private collectionName: string

  constructor(logger?: SimpleLogger) {
    this.collectionName = COLLECTION_NAME
    this.db = createFirestoreInstance()
    this.logger = logger || createDefaultLogger()
  }

  /**
   * List all experience entries for a user
   * Sorted by startDate (newest first)
   */
  async listEntries(userId: string): Promise<ExperienceEntry[]> {
    try {
      const snapshot = await this.db
        .collection(this.collectionName)
        .where("userId", "==", userId)
        .where("type", "==", "experience")
        .orderBy("startDate", "desc")
        .get()

      const entries = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ExperienceEntry[]

      this.logger.info("Retrieved experience entries", {
        userId,
        count: entries.length,
      })

      return entries
    } catch (error) {
      this.logger.error("Failed to list experience entries", { error, userId })
      throw error
    }
  }

  /**
   * Get a single experience entry by ID
   */
  async getEntry(id: string, userId: string): Promise<ExperienceEntry | null> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        this.logger.info("Experience entry not found", { id, userId })
        return null
      }

      const entry = {
        id: doc.id,
        ...doc.data(),
      } as ExperienceEntry

      // Verify ownership
      if (entry.userId !== userId) {
        this.logger.warning("User attempted to access entry they don't own", {
          id,
          userId,
          ownerId: entry.userId,
        })
        return null
      }

      this.logger.info("Retrieved experience entry", { id, userId })
      return entry
    } catch (error) {
      this.logger.error("Failed to get experience entry", { error, id, userId })
      throw error
    }
  }

  /**
   * Create a new experience entry
   */
  async createEntry(data: CreateExperienceData, userId: string): Promise<ExperienceEntry> {
    try {
      // Validate required fields
      if (!data.company || !data.role || !data.startDate) {
        throw new Error("Missing required fields: company, role, startDate")
      }

      // Validate date format (YYYY-MM)
      const dateRegex = /^\d{4}-\d{2}$/
      if (!dateRegex.test(data.startDate)) {
        throw new Error("startDate must be in YYYY-MM format")
      }
      if (data.endDate && !dateRegex.test(data.endDate)) {
        throw new Error("endDate must be in YYYY-MM format")
      }

      const docRef = this.db.collection(this.collectionName).doc()

      const entry = {
        id: docRef.id,
        type: "experience" as const,
        userId,
        company: data.company,
        role: data.role,
        location: data.location || null,
        startDate: data.startDate,
        endDate: data.endDate,
        highlights: data.highlights || [],
        technologies: data.technologies || [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }

      await docRef.set(entry)

      this.logger.info("Created experience entry", {
        id: docRef.id,
        userId,
        company: data.company,
        role: data.role,
      })

      // Fetch created document to get server timestamps
      const createdDoc = await docRef.get()
      return {
        id: createdDoc.id,
        ...createdDoc.data(),
      } as ExperienceEntry
    } catch (error) {
      this.logger.error("Failed to create experience entry", { error, userId })
      throw error
    }
  }

  /**
   * Update an existing experience entry
   */
  async updateEntry(
    id: string,
    data: UpdateExperienceData,
    userId: string
  ): Promise<ExperienceEntry> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        throw new Error(`Experience entry not found: ${id}`)
      }

      const existingEntry = doc.data() as ExperienceEntry

      // Verify ownership
      if (existingEntry.userId !== userId) {
        throw new Error("User does not have permission to update this entry")
      }

      // Validate date formats if provided
      const dateRegex = /^\d{4}-\d{2}$/
      if (data.startDate && !dateRegex.test(data.startDate)) {
        throw new Error("startDate must be in YYYY-MM format")
      }
      if (data.endDate !== undefined && data.endDate !== null && !dateRegex.test(data.endDate)) {
        throw new Error("endDate must be in YYYY-MM format")
      }

      // Build updates object
      const updates: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      }

      if (data.company !== undefined) updates.company = data.company
      if (data.role !== undefined) updates.role = data.role
      if (data.location !== undefined) updates.location = data.location || null
      if (data.startDate !== undefined) updates.startDate = data.startDate
      if (data.endDate !== undefined) updates.endDate = data.endDate
      if (data.highlights !== undefined) updates.highlights = data.highlights
      if (data.technologies !== undefined) updates.technologies = data.technologies

      await docRef.update(updates)

      this.logger.info("Updated experience entry", {
        id,
        userId,
        fieldsUpdated: Object.keys(updates).filter((k) => k !== "updatedAt"),
      })

      // Fetch updated document
      const updatedDoc = await docRef.get()
      return {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      } as ExperienceEntry
    } catch (error) {
      this.logger.error("Failed to update experience entry", { error, id, userId })
      throw error
    }
  }

  /**
   * Delete an experience entry
   */
  async deleteEntry(id: string, userId: string): Promise<void> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        throw new Error(`Experience entry not found: ${id}`)
      }

      const existingEntry = doc.data() as ExperienceEntry

      // Verify ownership
      if (existingEntry.userId !== userId) {
        throw new Error("User does not have permission to delete this entry")
      }

      await docRef.delete()

      this.logger.info("Deleted experience entry", { id, userId })
    } catch (error) {
      this.logger.error("Failed to delete experience entry", { error, id, userId })
      throw error
    }
  }

  /**
   * Get recent experience entries (for resume generation)
   * Returns the most recent N entries, useful for limiting resume length
   */
  async getRecentEntries(userId: string, limit: number = 5): Promise<ExperienceEntry[]> {
    try {
      const snapshot = await this.db
        .collection(this.collectionName)
        .where("userId", "==", userId)
        .where("type", "==", "experience")
        .orderBy("startDate", "desc")
        .limit(limit)
        .get()

      const entries = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ExperienceEntry[]

      this.logger.info("Retrieved recent experience entries", {
        userId,
        count: entries.length,
        limit,
      })

      return entries
    } catch (error) {
      this.logger.error("Failed to get recent experience entries", { error, userId, limit })
      throw error
    }
  }

  /**
   * Batch delete multiple experience entries
   * Useful for cleanup operations
   */
  async batchDelete(ids: string[], userId: string): Promise<void> {
    try {
      const batch = this.db.batch()

      // Verify ownership and prepare deletions
      for (const id of ids) {
        const docRef = this.db.collection(this.collectionName).doc(id)
        const doc = await docRef.get()

        if (!doc.exists) {
          this.logger.warning("Skipping non-existent entry in batch delete", { id, userId })
          continue
        }

        const entry = doc.data() as ExperienceEntry

        if (entry.userId !== userId) {
          this.logger.warning("Skipping entry user doesn't own in batch delete", {
            id,
            userId,
            ownerId: entry.userId,
          })
          continue
        }

        batch.delete(docRef)
      }

      await batch.commit()

      this.logger.info("Batch deleted experience entries", {
        userId,
        count: ids.length,
      })
    } catch (error) {
      this.logger.error("Failed to batch delete experience entries", { error, userId, ids })
      throw error
    }
  }
}

/**
 * Helper function to create an Experience service instance
 */
export function createExperienceService(logger?: SimpleLogger): ExperienceService {
  return new ExperienceService(logger)
}
