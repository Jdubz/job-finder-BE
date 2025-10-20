/**
 * Firestore Service Tests
 *
 * These tests validate the FirestoreService CRUD operations
 * and query functionality.
 */

import { FirestoreService } from "../firestore.service"

// Mock the Firestore config and logger
jest.mock("../../config/firestore")
jest.mock("../../utils/logger")

import { createFirestoreInstance } from "../../config/firestore"
import { createDefaultLogger } from "../../utils/logger"

describe("FirestoreService", () => {
  let mockDb: any
  let mockCollection: any
  let mockDoc: any
  let mockQuery: any
  let mockSnapshot: any
  let mockLogger: any
  let mockBatch: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Firestore document snapshot
    mockSnapshot = {
      exists: true,
      id: "test-doc-id",
      data: jest.fn().mockReturnValue({
        field1: "value1",
        field2: "value2",
      }),
    }

    // Mock Firestore document reference
    mockDoc = {
      get: jest.fn().mockResolvedValue(mockSnapshot),
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      id: "test-doc-id",
    }

    // Mock Firestore query snapshot
    const mockQuerySnapshot = {
      docs: [mockSnapshot],
      empty: false,
    }

    // Mock Firestore query
    mockQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      startAfter: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(mockQuerySnapshot),
    }

    // Mock Firestore collection reference
    mockCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
      add: jest.fn().mockResolvedValue(mockDoc),
      where: jest.fn().mockReturnValue(mockQuery),
      orderBy: jest.fn().mockReturnValue(mockQuery),
      limit: jest.fn().mockReturnValue(mockQuery),
      get: jest.fn().mockResolvedValue(mockQuerySnapshot),
    }

    // Mock Firestore batch
    mockBatch = {
      delete: jest.fn(),
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    }

    // Mock Firestore DB
    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
      batch: jest.fn().mockReturnValue(mockBatch),
    } as any

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      debug: jest.fn(),
    }

    // Setup mocks
    ;(createFirestoreInstance as jest.Mock).mockReturnValue(mockDb)
    ;(createDefaultLogger as jest.Mock).mockReturnValue(mockLogger)
  })

  describe("getDocument", () => {
    it("should retrieve a document by ID", async () => {
      const service = new FirestoreService(mockLogger)

      const result = await service.getDocument("test-collection", "test-doc-id")

      expect(mockDb.collection).toHaveBeenCalledWith("test-collection")
      expect(mockCollection.doc).toHaveBeenCalledWith("test-doc-id")
      expect(mockDoc.get).toHaveBeenCalled()
      expect(result).toEqual({ field1: "value1", field2: "value2" })
    })

    it("should return null when document does not exist", async () => {
      mockSnapshot.exists = false
      
      const service = new FirestoreService(mockLogger)

      const result = await service.getDocument("test-collection", "non-existent")

      expect(result).toBeNull()
    })

    it("should log error and throw when get fails", async () => {
      const error = new Error("Firestore error")
      mockDoc.get.mockRejectedValue(error)

      
      const service = new FirestoreService(mockLogger)

      await expect(service.getDocument("test-collection", "test-doc-id")).rejects.toThrow("Firestore error")
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get document"),
        expect.objectContaining({ error, docId: "test-doc-id" })
      )
    })
  })

  describe("createDocument", () => {
    it("should create a document with timestamps", async () => {
      
      const service = new FirestoreService(mockLogger)

      const testData = { name: "Test", value: 123 }
      const docId = await service.createDocument("test-collection", testData)

      expect(mockDb.collection).toHaveBeenCalledWith("test-collection")
      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test",
          value: 123,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      )
      expect(docId).toBe("test-doc-id")
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Document created"),
        expect.objectContaining({ docId: "test-doc-id" })
      )
    })

    it("should log error and throw when create fails", async () => {
      const error = new Error("Create failed")
      mockCollection.add.mockRejectedValue(error)

      
      const service = new FirestoreService(mockLogger)

      await expect(service.createDocument("test-collection", { data: "test" })).rejects.toThrow("Create failed")
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create document"),
        expect.objectContaining({ error })
      )
    })
  })

  describe("updateDocument", () => {
    it("should update a document with timestamp", async () => {
      
      const service = new FirestoreService(mockLogger)

      const updateData = { name: "Updated" }
      await service.updateDocument("test-collection", "test-doc-id", updateData)

      expect(mockDoc.get).toHaveBeenCalled()
      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated",
          updatedAt: expect.any(Date),
        })
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Document updated"),
        expect.objectContaining({ docId: "test-doc-id" })
      )
    })

    it("should throw error when document does not exist", async () => {
      mockSnapshot.exists = false

      
      const service = new FirestoreService(mockLogger)

      await expect(service.updateDocument("test-collection", "non-existent", { data: "test" })).rejects.toThrow(
        "Document non-existent not found"
      )
    })
  })

  describe("deleteDocument", () => {
    it("should delete an existing document", async () => {
      
      const service = new FirestoreService(mockLogger)

      await service.deleteDocument("test-collection", "test-doc-id")

      expect(mockDoc.get).toHaveBeenCalled()
      expect(mockDoc.delete).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Document deleted"),
        expect.objectContaining({ docId: "test-doc-id" })
      )
    })

    it("should throw error when document does not exist", async () => {
      mockSnapshot.exists = false

      
      const service = new FirestoreService(mockLogger)

      await expect(service.deleteDocument("test-collection", "non-existent")).rejects.toThrow(
        "Document non-existent not found"
      )
    })
  })

  describe("getDocumentsByUserId", () => {
    it("should query documents by user ID", async () => {
      
      const service = new FirestoreService(mockLogger)

      const results = await service.getDocumentsByUserId("test-collection", "user-123")

      expect(mockCollection.where).toHaveBeenCalledWith("userId", "==", "user-123")
      expect(mockQuery.orderBy).toHaveBeenCalledWith("createdAt", "desc")
      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        id: "test-doc-id",
        field1: "value1",
        field2: "value2",
      })
    })

    it("should apply limit when provided", async () => {
      
      const service = new FirestoreService(mockLogger)

      await service.getDocumentsByUserId("test-collection", "user-123", 10)

      expect(mockQuery.limit).toHaveBeenCalledWith(10)
    })
  })

  describe("getDocumentsByStatus", () => {
    it("should query documents by status", async () => {
      
      const service = new FirestoreService(mockLogger)

      const results = await service.getDocumentsByStatus("test-collection", "pending")

      expect(mockCollection.where).toHaveBeenCalledWith("status", "==", "pending")
      expect(mockQuery.orderBy).toHaveBeenCalledWith("createdAt", "asc")
      expect(results).toHaveLength(1)
    })

    it("should apply limit when provided", async () => {
      
      const service = new FirestoreService(mockLogger)

      await service.getDocumentsByStatus("test-collection", "pending", 5)

      expect(mockQuery.limit).toHaveBeenCalledWith(5)
    })
  })

  describe("setDocument", () => {
    it("should set a document with merge option", async () => {
      
      const service = new FirestoreService(mockLogger)

      const data = { field: "value" }
      await service.setDocument("test-collection", "specific-id", data)

      expect(mockDb.collection).toHaveBeenCalledWith("test-collection")
      expect(mockCollection.doc).toHaveBeenCalledWith("specific-id")
      expect(mockDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          field: "value",
          updatedAt: expect.any(Date),
        }),
        { merge: true }
      )
    })
  })

  describe("batchCreateDocuments", () => {
    it("should create multiple documents in a batch", async () => {
      
      const service = new FirestoreService(mockLogger)

      const documents = [{ name: "Doc1" }, { name: "Doc2" }]
      const docIds = await service.batchCreateDocuments("test-collection", documents)

      expect(mockDb.batch).toHaveBeenCalled()
      expect(docIds).toHaveLength(2)
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Batch created 2 documents"))
    })
  })

  describe("batchDeleteDocuments", () => {
    it("should delete multiple documents in a batch", async () => {
      
      const service = new FirestoreService(mockLogger)

      const docIds = ["doc1", "doc2", "doc3"]
      await service.batchDeleteDocuments("test-collection", docIds)

      expect(mockDb.batch).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Batch deleted 3 documents"))
    })
  })

  describe("verifyDocumentOwnership", () => {
    it("should return true when user owns the document", async () => {
      mockSnapshot.data = jest.fn().mockReturnValue({ userId: "user-123" })

      
      const service = new FirestoreService(mockLogger)

      const result = await service.verifyDocumentOwnership("test-collection", "test-doc-id", "user-123")

      expect(result).toBe(true)
    })

    it("should return false when user does not own the document", async () => {
      mockSnapshot.data = jest.fn().mockReturnValue({ userId: "user-456" })

      
      const service = new FirestoreService(mockLogger)

      const result = await service.verifyDocumentOwnership("test-collection", "test-doc-id", "user-123")

      expect(result).toBe(false)
    })

    it("should return false when document does not exist", async () => {
      mockSnapshot.exists = false

      
      const service = new FirestoreService(mockLogger)

      const result = await service.verifyDocumentOwnership("test-collection", "non-existent", "user-123")

      expect(result).toBe(false)
    })
  })

  describe("queryDocuments", () => {
    it("should build and execute a query with filters", async () => {
      
      const service = new FirestoreService(mockLogger)

      const filters = [
        { field: "status", operator: "==", value: "active" },
        { field: "userId", operator: "==", value: "user-123" },
      ]

      const results = await service.queryDocuments("test-collection", filters, "createdAt", "desc", 10)

      expect(mockCollection.where).toHaveBeenCalledWith("status", "==", "active")
      expect(mockQuery.where).toHaveBeenCalledWith("userId", "==", "user-123")
      expect(mockQuery.orderBy).toHaveBeenCalledWith("createdAt", "desc")
      expect(mockQuery.limit).toHaveBeenCalledWith(10)
      expect(results).toHaveLength(1)
    })

    it("should handle pagination with startAfter", async () => {
      
      const service = new FirestoreService(mockLogger)

      const lastDoc = { id: "last-doc" }
      await service.queryDocuments("test-collection", [], "createdAt", "desc", 10, lastDoc)

      expect(mockQuery.startAfter).toHaveBeenCalledWith(lastDoc)
    })
  })

  describe("getCollection", () => {
    it("should return a collection reference", async () => {
      
      const service = new FirestoreService(mockLogger)

      const collection = service.getCollection("test-collection")

      expect(mockDb.collection).toHaveBeenCalledWith("test-collection")
      expect(collection).toBe(mockCollection)
    })
  })

  describe("createFirestoreService helper", () => {
    it("should create a FirestoreService instance", async () => {
      const { createFirestoreService } = require("../firestore.service")
      const service = createFirestoreService(mockLogger)

      expect(service).toBeDefined()
      expect(service.getDocument).toBeDefined()
    })
  })
})
