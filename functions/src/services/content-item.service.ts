/**
 * Content Item Service
 *
 * Unified content management for resume building blocks.
 * Replaces the deprecated blurbs system with structured content types.
 *
 * Supported content types:
 * - company: Employment history
 * - project: Projects (standalone or nested under companies)
 * - skill-group: Categorized skills
 * - education: Formal education and certifications
 * - profile-section: About/intro sections
 * - accomplishment: Granular achievements
 */

import { FieldValue } from "@google-cloud/firestore"
import type { SimpleLogger } from "../types/logger.types"
import { createDefaultLogger } from "../utils/logger"
import { createFirestoreInstance } from "../config/firestore"
import { CONTENT_ITEMS_COLLECTION } from "../config/database"
import type {
  ContentItem,
  ContentItemType,
  ContentItemVisibility,
  CreateContentItemData,
  UpdateContentItemData,
} from "@jsdubzw/job-finder-shared-types"

export class ContentItemService {
  private db: FirebaseFirestore.Firestore
  private logger: SimpleLogger
  private collectionName: string

  constructor(logger?: SimpleLogger) {
    this.collectionName = CONTENT_ITEMS_COLLECTION
    this.db = createFirestoreInstance()
    this.logger = logger || createDefaultLogger()
  }

  /**
   * ============================================================================
   * LIST OPERATIONS
   * ============================================================================
   */

  /**
   * List all content items for a user
   */
  async listItems(userId: string, options?: {
    type?: ContentItemType
    visibility?: ContentItemVisibility
    parentId?: string
    limit?: number
  }): Promise<ContentItem[]> {
    try {
      let query = this.db
        .collection(this.collectionName)
        .where("userId", "==", userId) as FirebaseFirestore.Query

      // Filter by type if specified
      if (options?.type) {
        query = query.where("type", "==", options.type)
      }

      // Filter by visibility if specified
      if (options?.visibility) {
        query = query.where("visibility", "==", options.visibility)
      }

      // Filter by parentId if specified
      if (options?.parentId !== undefined) {
        query = query.where("parentId", "==", options.parentId)
      }

      // Order by order field (for user-defined ordering)
      query = query.orderBy("order", "asc")

      // Apply limit if specified
      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const snapshot = await query.get()
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ContentItem[]

      this.logger.info("Retrieved content items", {
        userId,
        count: items.length,
        type: options?.type,
        visibility: options?.visibility,
      })

      return items
    } catch (error) {
      this.logger.error("Failed to list content items", { error, userId })
      throw error
    }
  }

  /**
   * Get a single content item by ID
   */
  async getItem(id: string, userId: string): Promise<ContentItem | null> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        this.logger.info("Content item not found", { id, userId })
        return null
      }

      const item = {
        id: doc.id,
        ...doc.data(),
      } as ContentItem

      // Verify ownership
      if (item.userId !== userId) {
        this.logger.warning("User attempted to access item they don't own", {
          id,
          userId,
          ownerId: item.userId,
        })
        return null
      }

      this.logger.info("Retrieved content item", { id, userId, type: item.type })
      return item
    } catch (error) {
      this.logger.error("Failed to get content item", { error, id, userId })
      throw error
    }
  }

  /**
   * ============================================================================
   * CREATE OPERATIONS
   * ============================================================================
   */

  /**
   * Create a new content item
   */
  async createItem(data: CreateContentItemData, userId: string): Promise<ContentItem> {
    try {
      const docRef = this.db.collection(this.collectionName).doc()

      const item = {
        id: docRef.id,
        ...data,
        userId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: userId,
        updatedBy: userId,
      }

      await docRef.set(item)

      this.logger.info("Created content item", {
        id: docRef.id,
        userId,
        type: data.type,
      })

      // Fetch created document to get server timestamps
      const createdDoc = await docRef.get()
      return {
        id: createdDoc.id,
        ...createdDoc.data(),
      } as ContentItem
    } catch (error) {
      this.logger.error("Failed to create content item", { error, userId, type: data.type })
      throw error
    }
  }

  /**
   * ============================================================================
   * UPDATE OPERATIONS
   * ============================================================================
   */

  /**
   * Update an existing content item
   */
  async updateItem(
    id: string,
    data: UpdateContentItemData,
    userId: string
  ): Promise<ContentItem> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        throw new Error(`Content item not found: ${id}`)
      }

      const existingItem = doc.data() as ContentItem

      // Verify ownership
      if (existingItem.userId !== userId) {
        throw new Error("User does not have permission to update this item")
      }

      // Build updates object
      const updates: Record<string, unknown> = {
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userId,
      }

      await docRef.update(updates)

      this.logger.info("Updated content item", {
        id,
        userId,
        type: existingItem.type,
        fieldsUpdated: Object.keys(data),
      })

      // Fetch updated document
      const updatedDoc = await docRef.get()
      return {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      } as ContentItem
    } catch (error) {
      this.logger.error("Failed to update content item", { error, id, userId })
      throw error
    }
  }

  /**
   * Reorder content items
   * Updates the order field for multiple items in a batch
   */
  async reorderItems(
    updates: Array<{ id: string; order: number }>,
    userId: string
  ): Promise<void> {
    try {
      const batch = this.db.batch()

      for (const update of updates) {
        const docRef = this.db.collection(this.collectionName).doc(update.id)
        const doc = await docRef.get()

        if (!doc.exists) {
          this.logger.warning("Skipping non-existent item in reorder", {
            id: update.id,
            userId,
          })
          continue
        }

        const item = doc.data() as ContentItem

        if (item.userId !== userId) {
          this.logger.warning("Skipping item user doesn't own in reorder", {
            id: update.id,
            userId,
            ownerId: item.userId,
          })
          continue
        }

        batch.update(docRef, {
          order: update.order,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: userId,
        })
      }

      await batch.commit()

      this.logger.info("Reordered content items", {
        userId,
        count: updates.length,
      })
    } catch (error) {
      this.logger.error("Failed to reorder content items", { error, userId })
      throw error
    }
  }

  /**
   * ============================================================================
   * DELETE OPERATIONS
   * ============================================================================
   */

  /**
   * Delete a content item
   * Also deletes nested items (e.g., projects under a company)
   */
  async deleteItem(id: string, userId: string, cascadeDelete: boolean = true): Promise<void> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        throw new Error(`Content item not found: ${id}`)
      }

      const existingItem = doc.data() as ContentItem

      // Verify ownership
      if (existingItem.userId !== userId) {
        throw new Error("User does not have permission to delete this item")
      }

      // If cascade delete is enabled, delete all nested items
      if (cascadeDelete) {
        const nestedItems = await this.listItems(userId, { parentId: id })

        if (nestedItems.length > 0) {
          this.logger.info("Cascade deleting nested items", {
            parentId: id,
            count: nestedItems.length,
          })

          const batch = this.db.batch()
          for (const nestedItem of nestedItems) {
            const nestedDocRef = this.db.collection(this.collectionName).doc(nestedItem.id)
            batch.delete(nestedDocRef)
          }
          await batch.commit()
        }
      }

      // Delete the main item
      await docRef.delete()

      this.logger.info("Deleted content item", {
        id,
        userId,
        type: existingItem.type,
        cascadeDelete,
      })
    } catch (error) {
      this.logger.error("Failed to delete content item", { error, id, userId })
      throw error
    }
  }

  /**
   * Batch delete multiple content items
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

        const item = doc.data() as ContentItem

        if (item.userId !== userId) {
          this.logger.warning("Skipping item user doesn't own in batch delete", {
            id,
            userId,
            ownerId: item.userId,
          })
          continue
        }

        batch.delete(docRef)
      }

      await batch.commit()

      this.logger.info("Batch deleted content items", {
        userId,
        count: ids.length,
      })
    } catch (error) {
      this.logger.error("Failed to batch delete content items", { error, userId, ids })
      throw error
    }
  }

  /**
   * ============================================================================
   * UTILITY OPERATIONS
   * ============================================================================
   */

  /**
   * Change visibility of an item
   */
  async changeVisibility(
    id: string,
    visibility: ContentItemVisibility,
    userId: string
  ): Promise<ContentItem> {
    try {
      return await this.updateItem(id, { visibility }, userId)
    } catch (error) {
      this.logger.error("Failed to change visibility", { error, id, userId, visibility })
      throw error
    }
  }

  /**
   * Get items by tag
   */
  async getItemsByTag(tag: string, userId: string): Promise<ContentItem[]> {
    try {
      const snapshot = await this.db
        .collection(this.collectionName)
        .where("userId", "==", userId)
        .where("tags", "array-contains", tag)
        .get()

      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ContentItem[]

      this.logger.info("Retrieved items by tag", {
        userId,
        tag,
        count: items.length,
      })

      return items
    } catch (error) {
      this.logger.error("Failed to get items by tag", { error, userId, tag })
      throw error
    }
  }

  /**
   * Get nested items (e.g., projects under a company)
   */
  async getNestedItems(parentId: string, userId: string): Promise<ContentItem[]> {
    try {
      return await this.listItems(userId, { parentId })
    } catch (error) {
      this.logger.error("Failed to get nested items", { error, userId, parentId })
      throw error
    }
  }

  /**
   * Count items by type
   */
  async countItemsByType(userId: string): Promise<Record<ContentItemType, number>> {
    try {
      const allItems = await this.listItems(userId)

      const counts: Record<string, number> = {}
      for (const item of allItems) {
        counts[item.type] = (counts[item.type] || 0) + 1
      }

      this.logger.info("Counted items by type", { userId, counts })

      return counts as Record<ContentItemType, number>
    } catch (error) {
      this.logger.error("Failed to count items by type", { error, userId })
      throw error
    }
  }
}

/**
 * Helper function to create a Content Item service instance
 */
export function createContentItemService(logger?: SimpleLogger): ContentItemService {
  return new ContentItemService(logger)
}
