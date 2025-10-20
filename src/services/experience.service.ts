import { Firestore, Timestamp } from "@google-cloud/firestore"
import { EXPERIENCE_COLLECTION } from "../config/database"
import { createFirestoreInstance } from "../config/firestore"
import { createDefaultLogger } from "../utils/logger"
import type { SimpleLogger } from "../types/logger.types"

// Use collection name from config
const COLLECTION_NAME = EXPERIENCE_COLLECTION

export interface ExperienceEntry {
  id: string
  title: string
  role?: string // Job title/role (optional)
  location?: string // Location (optional)
  body?: string // Deprecated - kept for backward compatibility
  startDate: string // YYYY-MM format
  endDate?: string | null // YYYY-MM format or null (= Present)
  notes?: string
  order?: number // For sorting (lower = earlier), optional for backward compatibility
  relatedBlurbIds?: string[] // References to associated blurbs, optional for backward compatibility

  // NEW: Structured fields
  renderType?: "structured-entry" | "simple-entry" | "text"
  summary?: string
  accomplishments?: string[]
  technologies?: string[]
  projects?: Array<{
    name: string
    description: string
    technologies?: string[]
    challenges?: string[]
  }>

  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string // Email of creator
  updatedBy: string // Email of last editor
}

export interface CreateExperienceData {
  title: string
  role?: string
  location?: string
  body?: string
  startDate: string
  endDate?: string | null
  notes?: string
  order?: number
  relatedBlurbIds?: string[]
}

export interface UpdateExperienceData {
  title?: string
  role?: string
  location?: string
  body?: string
  startDate?: string
  endDate?: string | null
  notes?: string
  order?: number
  relatedBlurbIds?: string[]
  // Structured fields
  renderType?: "structured-entry" | "simple-entry" | "text"
  summary?: string
  accomplishments?: string[]
  technologies?: string[]
  projects?: Array<{
    name: string
    description: string
    technologies?: string[]
    challenges?: string[]
  }>
}

export class ExperienceService {
  private db: Firestore
  private logger: SimpleLogger
  private collectionName = COLLECTION_NAME

  constructor(logger?: SimpleLogger) {
    // Use shared Firestore factory for consistent configuration
    this.db = createFirestoreInstance()

    // Use shared logger factory
    this.logger = logger || createDefaultLogger()
  }

  /**
   * List all experience entries, sorted by order (ascending) or fallback to startDate (newest first)
   */
  async listEntries(): Promise<ExperienceEntry[]> {
    try {
      // Use order field for sorting (lower values appear first)
      // Fallback to startDate descending for entries without order field (backward compatibility)
      const snapshot = await this.db
        .collection(this.collectionName)
        .orderBy("order", "asc")
        .get()

      const entries = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<ExperienceEntry, "id">),
      }))

      this.logger.info("Retrieved experience entries", {
        count: entries.length,
      })

      return entries
    } catch (error) {
      this.logger.error("Failed to list experience entries", { error })
      throw error
    }
  }

  /**
   * Get a single experience entry by ID
   */
  async getEntry(id: string): Promise<ExperienceEntry | null> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        this.logger.info("Experience entry not found", { id })
        return null
      }

      const entry = {
        id: doc.id,
        ...(doc.data() as Omit<ExperienceEntry, "id">),
      }

      this.logger.info("Retrieved experience entry", { id })
      return entry
    } catch (error) {
      this.logger.error("Failed to get experience entry", { error, id })
      throw error
    }
  }

  /**
   * Create a new experience entry
   */
  async createEntry(data: CreateExperienceData, userEmail: string): Promise<ExperienceEntry> {
    try {
      const now = Timestamp.now()

      // Build entry object, omitting undefined/empty fields
      // Firestore doesn't accept undefined values, so we only include defined fields
      const entry: Record<string, unknown> = {
        title: data.title,
        startDate: data.startDate,
        endDate: data.endDate || null,
        createdAt: now,
        updatedAt: now,
        createdBy: userEmail,
        updatedBy: userEmail,
      }

      // Only add optional fields if they have non-empty values
      if (data.role && data.role.trim() !== "") {
        entry.role = data.role
      }
      if (data.location && data.location.trim() !== "") {
        entry.location = data.location
      }
      if (data.body && data.body.trim() !== "") {
        entry.body = data.body
      }
      if (data.notes && data.notes.trim() !== "") {
        entry.notes = data.notes
      }
      if (data.order !== undefined) {
        entry.order = data.order
      }
      if (data.relatedBlurbIds !== undefined) {
        entry.relatedBlurbIds = data.relatedBlurbIds
      }

      const docRef = await this.db.collection(this.collectionName).add(entry)

      // Return the created entry with the generated ID
      // Cast entry as Omit<ExperienceEntry, "id"> since we know it has all required fields
      const createdEntry: ExperienceEntry = {
        id: docRef.id,
        ...(entry as Omit<ExperienceEntry, "id">),
      }

      this.logger.info("Created experience entry", {
        id: docRef.id,
        title: data.title,
        createdBy: userEmail,
      })

      return createdEntry
    } catch (error) {
      this.logger.error("Failed to create experience entry", {
        error,
        data,
        userEmail,
      })
      throw error
    }
  }

  /**
   * Update an existing experience entry
   */
  async updateEntry(id: string, data: UpdateExperienceData, userEmail: string): Promise<ExperienceEntry> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        throw new Error(`Experience entry not found: ${id}`)
      }

      // Build updates object, omitting undefined values
      // Firestore doesn't accept undefined, but null is OK for clearing fields
      const updates: Record<string, unknown> = {
        updatedAt: Timestamp.now(),
        updatedBy: userEmail,
      }

      // Only update provided fields
      if (data.title !== undefined) {
        updates.title = data.title
      }
      if (data.role !== undefined) {
        // If empty string, use null to clear the field
        updates.role = data.role && data.role.trim() !== "" ? data.role : null
      }
      if (data.location !== undefined) {
        updates.location = data.location && data.location.trim() !== "" ? data.location : null
      }
      if (data.body !== undefined) {
        updates.body = data.body && data.body.trim() !== "" ? data.body : null
      }
      if (data.startDate !== undefined) {
        updates.startDate = data.startDate
      }
      if (data.endDate !== undefined) {
        updates.endDate = data.endDate
      }
      if (data.notes !== undefined) {
        updates.notes = data.notes && data.notes.trim() !== "" ? data.notes : null
      }
      if (data.order !== undefined) {
        updates.order = data.order
      }
      if (data.relatedBlurbIds !== undefined) {
        updates.relatedBlurbIds = data.relatedBlurbIds
      }
      // Structured fields
      if (data.renderType !== undefined) {
        updates.renderType = data.renderType
      }
      if (data.summary !== undefined) {
        updates.summary = data.summary && data.summary.trim() !== "" ? data.summary : null
      }
      if (data.accomplishments !== undefined) {
        updates.accomplishments = data.accomplishments
      }
      if (data.technologies !== undefined) {
        updates.technologies = data.technologies
      }
      if (data.projects !== undefined) {
        updates.projects = data.projects
      }

      await docRef.update(updates)

      // Fetch updated document
      const updatedDoc = await docRef.get()
      const updatedEntry: ExperienceEntry = {
        id: updatedDoc.id,
        ...(updatedDoc.data() as Omit<ExperienceEntry, "id">),
      }

      this.logger.info("Updated experience entry", {
        id,
        updatedBy: userEmail,
        fieldsUpdated: Object.keys(updates).filter((k) => k !== "updatedAt" && k !== "updatedBy"),
      })

      return updatedEntry
    } catch (error) {
      this.logger.error("Failed to update experience entry", {
        error,
        id,
        data,
        userEmail,
      })
      throw error
    }
  }

  /**
   * Delete an experience entry
   */
  async deleteEntry(id: string): Promise<void> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        throw new Error(`Experience entry not found: ${id}`)
      }

      await docRef.delete()

      this.logger.info("Deleted experience entry", { id })
    } catch (error) {
      this.logger.error("Failed to delete experience entry", {
        error,
        id,
      })
      throw error
    }
  }
}
