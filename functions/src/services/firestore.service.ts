import { Firestore } from "@google-cloud/firestore"
import { createFirestoreInstance } from "../config/firestore"
import { createDefaultLogger } from "../utils/logger"
import type { SimpleLogger } from "../types/logger.types"

/**
 * Base Firestore service for job-finder
 * Provides common database operations across all collections
 */
export class FirestoreService {
  protected db: Firestore
  protected logger: SimpleLogger

  constructor(logger?: SimpleLogger) {
    // Use shared Firestore factory for consistent configuration
    this.db = createFirestoreInstance()

    // Use shared logger factory
    this.logger = logger || createDefaultLogger()
  }

  /**
   * Get the Firestore instance
   * Useful for services that extend this class
   */
  protected getDb(): Firestore {
    return this.db
  }

  /**
   * Get a document by ID from a collection
   */
  async getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
    try {
      const docRef = this.db.collection(collectionName).doc(docId)
      const doc = await docRef.get()

      if (!doc.exists) {
        return null
      }

      return doc.data() as T
    } catch (error) {
      this.logger.error(`Failed to get document from ${collectionName}`, {
        error,
        docId,
      })
      throw error
    }
  }

  /**
   * Get documents by user ID
   */
  async getDocumentsByUserId<T>(
    collectionName: string,
    userId: string,
    limit?: number
  ): Promise<Array<T & { id: string }>> {
    try {
      let query = this.db.collection(collectionName).where("userId", "==", userId).orderBy("createdAt", "desc")

      if (limit) {
        query = query.limit(limit) as any
      }

      const snapshot = await query.get()

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as T),
      }))
    } catch (error) {
      this.logger.error(`Failed to get documents from ${collectionName} for user`, {
        error,
        userId,
      })
      throw error
    }
  }

  /**
   * Create a new document in a collection
   */
  async createDocument<T>(collectionName: string, data: T): Promise<string> {
    try {
      const now = new Date()
      const docData = {
        ...data,
        createdAt: now,
        updatedAt: now,
      }

      const docRef = await this.db.collection(collectionName).add(docData)

      this.logger.info(`Document created in ${collectionName}`, {
        docId: docRef.id,
      })

      return docRef.id
    } catch (error) {
      this.logger.error(`Failed to create document in ${collectionName}`, {
        error,
      })
      throw error
    }
  }

  /**
   * Update a document in a collection
   */
  async updateDocument(collectionName: string, docId: string, data: Partial<any>): Promise<void> {
    try {
      const docRef = this.db.collection(collectionName).doc(docId)

      // Check if document exists
      const doc = await docRef.get()
      if (!doc.exists) {
        throw new Error(`Document ${docId} not found in ${collectionName}`)
      }

      await docRef.update({
        ...data,
        updatedAt: new Date(),
      })

      this.logger.info(`Document updated in ${collectionName}`, {
        docId,
      })
    } catch (error) {
      this.logger.error(`Failed to update document in ${collectionName}`, {
        error,
        docId,
      })
      throw error
    }
  }

  /**
   * Delete a document from a collection
   */
  async deleteDocument(collectionName: string, docId: string): Promise<void> {
    try {
      const docRef = this.db.collection(collectionName).doc(docId)

      // Check if document exists
      const doc = await docRef.get()
      if (!doc.exists) {
        throw new Error(`Document ${docId} not found in ${collectionName}`)
      }

      await docRef.delete()

      this.logger.info(`Document deleted from ${collectionName}`, {
        docId,
      })
    } catch (error) {
      this.logger.error(`Failed to delete document from ${collectionName}`, {
        error,
        docId,
      })
      throw error
    }
  }

  /**
   * Check if a document exists and belongs to a user
   */
  async verifyDocumentOwnership(collectionName: string, docId: string, userId: string): Promise<boolean> {
    try {
      const doc = await this.getDocument<{ userId: string }>(collectionName, docId)

      if (!doc) {
        return false
      }

      return doc.userId === userId
    } catch (error) {
      this.logger.error(`Failed to verify document ownership`, {
        error,
        collectionName,
        docId,
        userId,
      })
      return false
    }
  }

  /**
   * Batch delete documents
   */
  async batchDeleteDocuments(collectionName: string, docIds: string[]): Promise<void> {
    try {
      const batch = this.db.batch()

      docIds.forEach((docId) => {
        const docRef = this.db.collection(collectionName).doc(docId)
        batch.delete(docRef)
      })

      await batch.commit()

      this.logger.info(`Batch deleted ${docIds.length} documents from ${collectionName}`)
    } catch (error) {
      this.logger.error(`Failed to batch delete documents from ${collectionName}`, {
        error,
        docIds,
      })
      throw error
    }
  }
}

/**
 * Helper function to get a Firestore service instance
 */
export function createFirestoreService(logger?: SimpleLogger): FirestoreService {
  return new FirestoreService(logger)
}
