/**
 * Job Queue Service
 *
 * Manages the job application queue for tracking user's job opportunities.
 * Includes stop-list matching, duplicate detection, and status management.
 *
 * Queue lifecycle:
 * - pending: Newly added, waiting to be processed
 * - processing: Currently being scraped/analyzed
 * - success: Successfully processed and saved to job-matches
 * - failed: Processing error occurred
 * - skipped: Skipped (duplicate or stop-list blocked)
 * - filtered: Rejected by filter engine
 */

import { FieldValue } from "@google-cloud/firestore"
import type { SimpleLogger } from "../types/logger.types"
import { createDefaultLogger } from "../utils/logger"
import { createFirestoreInstance } from "../config/firestore"
import { JOB_QUEUE_COLLECTION } from "../config/database"
import type {
  QueueItem,
  QueueStatus,
  QueueItemType,
  QueueSource,
  StopList,
} from "@jsdubzw/job-finder-shared-types"

/**
 * Data for creating a new queue item
 */
export interface CreateQueueItemData {
  type: QueueItemType
  url: string
  companyName: string
  companyId?: string | null
  source?: QueueSource
  submittedBy?: string | null // User UID
}

/**
 * Data for updating a queue item
 */
export interface UpdateQueueItemData {
  status?: QueueStatus
  resultMessage?: string
  errorDetails?: string
  retryCount?: number
  processedAt?: Date
  completedAt?: Date
}

export class JobQueueService {
  private db: FirebaseFirestore.Firestore
  private logger: SimpleLogger
  private collectionName: string
  private stopListDocPath = "job-finder-config/stop-list"

  constructor(logger?: SimpleLogger) {
    this.collectionName = JOB_QUEUE_COLLECTION
    this.db = createFirestoreInstance()
    this.logger = logger || createDefaultLogger()
  }

  /**
   * ============================================================================
   * QUEUE ITEM OPERATIONS
   * ============================================================================
   */

  /**
   * List queue items for a user
   */
  async listItems(
    userId: string,
    options?: {
      status?: QueueStatus
      type?: QueueItemType
      limit?: number
    }
  ): Promise<QueueItem[]> {
    try {
      let query = this.db
        .collection(this.collectionName)
        .where("submitted_by", "==", userId) as FirebaseFirestore.Query

      if (options?.status) {
        query = query.where("status", "==", options.status)
      }

      if (options?.type) {
        query = query.where("type", "==", options.type)
      }

      // Order by created date (newest first)
      query = query.orderBy("created_at", "desc")

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const snapshot = await query.get()
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as QueueItem[]

      this.logger.info("Retrieved queue items", {
        userId,
        count: items.length,
        status: options?.status,
        type: options?.type,
      })

      return items
    } catch (error) {
      this.logger.error("Failed to list queue items", { error, userId })
      throw error
    }
  }

  /**
   * Get a single queue item by ID
   */
  async getItem(id: string, userId: string): Promise<QueueItem | null> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        this.logger.info("Queue item not found", { id, userId })
        return null
      }

      const item = {
        id: doc.id,
        ...doc.data(),
      } as QueueItem

      // Verify ownership
      if (item.submitted_by !== userId) {
        this.logger.warning("User attempted to access queue item they don't own", {
          id,
          userId,
          ownerId: item.submitted_by,
        })
        return null
      }

      this.logger.info("Retrieved queue item", { id, userId })
      return item
    } catch (error) {
      this.logger.error("Failed to get queue item", { error, id, userId })
      throw error
    }
  }

  /**
   * Create a new queue item with duplicate detection and stop-list checking
   */
  async createItem(data: CreateQueueItemData, userId: string): Promise<QueueItem> {
    try {
      // Check for duplicates
      const isDuplicate = await this.checkDuplicate(data.url, userId)
      if (isDuplicate) {
        throw new Error("A queue item with this URL already exists")
      }

      // Check stop-list
      const isBlocked = await this.checkStopList(data.companyName, data.url)
      if (isBlocked) {
        throw new Error("This company or URL is on the stop-list")
      }

      const docRef = this.db.collection(this.collectionName).doc()

      const item: Omit<QueueItem, "id"> = {
        type: data.type,
        status: "pending",
        url: data.url,
        company_name: data.companyName,
        company_id: data.companyId || null,
        source: data.source || "user_submission",
        submitted_by: data.submittedBy || userId,
        retry_count: 0,
        max_retries: 3,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      }

      await docRef.set(item)

      this.logger.info("Created queue item", {
        id: docRef.id,
        userId,
        type: data.type,
        url: data.url,
        company: data.companyName,
      })

      // Fetch created document to get server timestamps
      const createdDoc = await docRef.get()
      return {
        id: createdDoc.id,
        ...createdDoc.data(),
      } as QueueItem
    } catch (error) {
      this.logger.error("Failed to create queue item", { error, userId })
      throw error
    }
  }

  /**
   * Update a queue item
   */
  async updateItem(
    id: string,
    data: UpdateQueueItemData,
    userId: string
  ): Promise<QueueItem> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        throw new Error(`Queue item not found: ${id}`)
      }

      const existingItem = doc.data() as QueueItem

      // Verify ownership
      if (existingItem.submitted_by !== userId) {
        throw new Error("User does not have permission to update this queue item")
      }

      // Build updates object
      const updates: Record<string, unknown> = {
        ...data,
        updated_at: FieldValue.serverTimestamp(),
      }

      await docRef.update(updates)

      this.logger.info("Updated queue item", {
        id,
        userId,
        fieldsUpdated: Object.keys(data),
      })

      // Fetch updated document
      const updatedDoc = await docRef.get()
      return {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      } as QueueItem
    } catch (error) {
      this.logger.error("Failed to update queue item", { error, id, userId })
      throw error
    }
  }

  /**
   * Delete a queue item
   */
  async deleteItem(id: string, userId: string): Promise<void> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        throw new Error(`Queue item not found: ${id}`)
      }

      const existingItem = doc.data() as QueueItem

      // Verify ownership
      if (existingItem.submitted_by !== userId) {
        throw new Error("User does not have permission to delete this queue item")
      }

      await docRef.delete()

      this.logger.info("Deleted queue item", { id, userId })
    } catch (error) {
      this.logger.error("Failed to delete queue item", { error, id, userId })
      throw error
    }
  }

  /**
   * ============================================================================
   * DUPLICATE DETECTION
   * ============================================================================
   */

  /**
   * Check if a URL already exists in the queue for this user
   */
  async checkDuplicate(url: string, userId: string): Promise<boolean> {
    try {
      const normalizedUrl = this.normalizeUrl(url)

      const snapshot = await this.db
        .collection(this.collectionName)
        .where("submitted_by", "==", userId)
        .where("url", "==", normalizedUrl)
        .limit(1)
        .get()

      const isDuplicate = !snapshot.empty

      if (isDuplicate) {
        this.logger.info("Duplicate URL detected", { url, userId })
      }

      return isDuplicate
    } catch (error) {
      this.logger.error("Failed to check for duplicates", { error, url, userId })
      throw error
    }
  }

  /**
   * Normalize URL for duplicate detection
   * Removes trailing slashes, query params, and fragments
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      // Keep protocol, host, and pathname only
      let normalized = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`
      // Remove trailing slash
      if (normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1)
      }
      return normalized
    } catch {
      // If URL parsing fails, return original
      return url
    }
  }

  /**
   * ============================================================================
   * STOP-LIST CHECKING
   * ============================================================================
   */

  /**
   * Check if company or URL is on the stop-list
   */
  async checkStopList(companyName: string, url: string): Promise<boolean> {
    try {
      const stopList = await this.getStopList()

      if (!stopList) {
        return false // No stop-list configured
      }

      // Check company name (case-insensitive)
      const normalizedCompany = companyName.toLowerCase().trim()
      const blockedCompany = stopList.excludedCompanies?.some((excluded) =>
        normalizedCompany.includes(excluded.toLowerCase().trim())
      )

      if (blockedCompany) {
        this.logger.info("Company blocked by stop-list", { companyName })
        return true
      }

      // Check URL domain
      try {
        const urlObj = new URL(url)
        const domain = urlObj.hostname.replace(/^www\./, "") // Remove www. prefix
        const blockedDomain = stopList.excludedDomains?.some((excluded) =>
          domain.includes(excluded.toLowerCase().trim())
        )

        if (blockedDomain) {
          this.logger.info("URL domain blocked by stop-list", { url, domain })
          return true
        }
      } catch {
        // Invalid URL, skip domain check
      }

      // Check keywords in company name and URL
      const textToCheck = `${companyName} ${url}`.toLowerCase()
      const blockedKeyword = stopList.excludedKeywords?.some((keyword) =>
        textToCheck.includes(keyword.toLowerCase().trim())
      )

      if (blockedKeyword) {
        this.logger.info("Keyword blocked by stop-list", { companyName, url })
        return true
      }

      return false
    } catch (error) {
      this.logger.error("Failed to check stop-list", { error, companyName, url })
      // Fail open - don't block if stop-list check fails
      return false
    }
  }

  /**
   * Get the stop-list configuration
   */
  async getStopList(): Promise<StopList | null> {
    try {
      const docRef = this.db.doc(this.stopListDocPath)
      const doc = await docRef.get()

      if (!doc.exists) {
        return null
      }

      return doc.data() as StopList
    } catch (error) {
      this.logger.error("Failed to get stop-list", { error })
      throw error
    }
  }

  /**
   * Update the stop-list configuration
   */
  async updateStopList(data: Partial<StopList>, userId: string): Promise<StopList> {
    try {
      const docRef = this.db.doc(this.stopListDocPath)

      const updates = {
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userId,
      }

      await docRef.set(updates, { merge: true })

      this.logger.info("Updated stop-list", { userId })

      const updatedDoc = await docRef.get()
      return updatedDoc.data() as StopList
    } catch (error) {
      this.logger.error("Failed to update stop-list", { error, userId })
      throw error
    }
  }

  /**
   * ============================================================================
   * BATCH OPERATIONS
   * ============================================================================
   */

  /**
   * Batch delete queue items
   */
  async batchDelete(ids: string[], userId: string): Promise<void> {
    try {
      const batch = this.db.batch()

      for (const id of ids) {
        const docRef = this.db.collection(this.collectionName).doc(id)
        const doc = await docRef.get()

        if (!doc.exists) {
          this.logger.warning("Skipping non-existent item in batch delete", { id, userId })
          continue
        }

        const item = doc.data() as QueueItem

        if (item.submitted_by !== userId) {
          this.logger.warning("Skipping item user doesn't own in batch delete", {
            id,
            userId,
            ownerId: item.submitted_by,
          })
          continue
        }

        batch.delete(docRef)
      }

      await batch.commit()

      this.logger.info("Batch deleted queue items", {
        userId,
        count: ids.length,
      })
    } catch (error) {
      this.logger.error("Failed to batch delete queue items", { error, userId, ids })
      throw error
    }
  }

  /**
   * Clear completed items (success, failed, skipped)
   */
  async clearCompleted(userId: string): Promise<number> {
    try {
      const completedStatuses: QueueStatus[] = ["success", "failed", "skipped", "filtered"]

      const snapshot = await this.db
        .collection(this.collectionName)
        .where("submitted_by", "==", userId)
        .where("status", "in", completedStatuses)
        .get()

      const batch = this.db.batch()
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })

      await batch.commit()

      this.logger.info("Cleared completed queue items", {
        userId,
        count: snapshot.size,
      })

      return snapshot.size
    } catch (error) {
      this.logger.error("Failed to clear completed items", { error, userId })
      throw error
    }
  }

  /**
   * ============================================================================
   * STATISTICS
   * ============================================================================
   */

  /**
   * Get queue statistics for a user
   */
  async getStatistics(userId: string): Promise<Record<QueueStatus, number>> {
    try {
      const items = await this.listItems(userId)

      const stats: Record<string, number> = {
        pending: 0,
        processing: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        filtered: 0,
      }

      for (const item of items) {
        stats[item.status] = (stats[item.status] || 0) + 1
      }

      this.logger.info("Retrieved queue statistics", { userId, stats })

      return stats as Record<QueueStatus, number>
    } catch (error) {
      this.logger.error("Failed to get queue statistics", { error, userId })
      throw error
    }
  }
}

/**
 * Helper function to create a Job Queue service instance
 */
export function createJobQueueService(logger?: SimpleLogger): JobQueueService {
  return new JobQueueService(logger)
}
