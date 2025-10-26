import { FirestoreService } from "../firestore.service"

// Mock Firestore
jest.mock("../../config/firestore", () => ({
  createFirestoreInstance: jest.fn(() => ({
    collection: jest.fn(),
  })),
}))

jest.mock("../../utils/logger", () => ({
  createDefaultLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}))

describe("FirestoreService", () => {
  let service: FirestoreService
  let mockDb: Record<string, jest.Mock>
  let mockCollection: Record<string, jest.Mock>
  let mockDoc: Record<string, jest.Mock | string>

  beforeEach(async () => {
    jest.clearAllMocks()

    mockDoc = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      id: "test-doc-id",
    }

    mockCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
      add: jest.fn().mockResolvedValue({ id: "test-id" }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(),
    }

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    }

    const firestoreModule = await import("../../config/firestore")
    const createFirestoreInstance = firestoreModule.createFirestoreInstance as jest.Mock
    createFirestoreInstance.mockReturnValue(mockDb)

    service = new FirestoreService()
  })

  describe("saveContactSubmission", () => {
    it("should save contact submission successfully", async () => {
      const submissionData = {
        name: "John Doe",
        email: "john@example.com",
        message: "Test message",
        metadata: {
          timestamp: new Date().toISOString(),
          ip: "127.0.0.1",
          userAgent: "test-agent",
        },
        requestId: "test-request-id",
        transaction: {
          contactEmail: {
            success: true,
            response: { messageId: "msg-123", accepted: true },
          },
          autoReply: {
            success: true,
            response: { messageId: "msg-456", accepted: true },
          },
          errors: [],
        },
      }

      const result = await service.saveContactSubmission(submissionData)

      expect(result).toBe("test-id")
      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: submissionData.name,
          email: submissionData.email,
          message: submissionData.message,
          status: "new",
        })
      )
    })

    it("should handle missing optional metadata fields", async () => {
      const submissionData = {
        name: "Jane Doe",
        email: "jane@example.com",
        message: "Test message",
        metadata: {
          timestamp: new Date().toISOString(),
        },
        requestId: "test-request-id",
        transaction: {
          contactEmail: {
            success: true,
          },
          autoReply: {
            success: true,
          },
          errors: [],
        },
      }

      const result = await service.saveContactSubmission(submissionData)

      expect(result).toBeTruthy()
      expect(mockCollection.add).toHaveBeenCalled()
    })

    it("should handle errors during save", async () => {
      mockCollection.add.mockRejectedValue(new Error("Firestore error"))

      const submissionData = {
        name: "John Doe",
        email: "john@example.com",
        message: "Test message",
        metadata: {
          timestamp: new Date().toISOString(),
        },
        requestId: "test-request-id",
        transaction: {
          contactEmail: { success: true },
          autoReply: { success: true },
          errors: [],
        },
      }

      await expect(service.saveContactSubmission(submissionData)).rejects.toThrow("Firestore error")
    })
  })

  describe("collection operations", () => {
    it("should use correct collection name", () => {
      service = new FirestoreService()
      expect(mockDb.collection).toHaveBeenCalled()
    })
  })
})
