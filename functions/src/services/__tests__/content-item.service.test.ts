import { ContentItemService } from "../content-item.service"
import type { ContentItemType, ContentItemVisibility } from "../../types/content-item.types"

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

describe("ContentItemService", () => {
  let service: ContentItemService
  let mockDb: Record<string, jest.Mock>
  let mockCollection: Record<string, jest.Mock>
  let mockDoc: Record<string, jest.Mock | string | boolean>
  let mockQuery: Record<string, jest.Mock>

  beforeEach(async () => {
    jest.clearAllMocks()

    mockDoc = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      id: "test-doc-id",
      exists: true,
      data: jest.fn(),
    }

    mockQuery = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [],
        empty: false,
      }),
    }

    mockCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
      add: jest.fn().mockResolvedValue({ id: "test-id" }),
      where: jest.fn().mockReturnValue(mockQuery),
      orderBy: jest.fn().mockReturnValue(mockQuery),
      limit: jest.fn().mockReturnValue(mockQuery),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    }

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    }

    const firestoreModule = await import("../../config/firestore")
    const createFirestoreInstance = firestoreModule.createFirestoreInstance as jest.Mock
    createFirestoreInstance.mockReturnValue(mockDb)

    service = new ContentItemService()
  })

  describe("listItems", () => {
    it("should list items without filters", async () => {
      const mockItems = [
        {
          id: "item-1",
          title: "Test Item 1",
          type: "page" as ContentItemType,
          order: 1,
          visibility: "public" as ContentItemVisibility,
        },
        {
          id: "item-2",
          title: "Test Item 2",
          type: "section" as ContentItemType,
          order: 2,
          visibility: "public" as ContentItemVisibility,
        },
      ]

      mockQuery.get.mockResolvedValue({
        docs: mockItems.map((item) => ({
          id: item.id,
          data: () => ({ ...item }),
        })),
      })

      const result = await service.listItems()

      expect(result).toHaveLength(2)
      expect(mockCollection.orderBy).toHaveBeenCalledWith("order", "asc")
    })

    it("should filter by type", async () => {
      mockQuery.get.mockResolvedValue({ docs: [] })

      await service.listItems({ type: "page" as ContentItemType })

      expect(mockQuery.where).toHaveBeenCalledWith("type", "==", "page")
    })

    it("should filter by visibility", async () => {
      mockQuery.get.mockResolvedValue({ docs: [] })

      await service.listItems({ visibility: "private" as ContentItemVisibility })

      expect(mockQuery.where).toHaveBeenCalledWith("visibility", "==", "private")
    })

    it("should apply limit", async () => {
      mockQuery.get.mockResolvedValue({ docs: [] })

      await service.listItems({ limit: 10 })

      expect(mockQuery.limit).toHaveBeenCalledWith(10)
    })

    it("should handle errors", async () => {
      mockQuery.get.mockRejectedValue(new Error("Database error"))

      await expect(service.listItems()).rejects.toThrow("Database error")
    })
  })

  describe("getItem", () => {
    it("should retrieve item by id", async () => {
      const mockItem = {
        title: "Test Item",
        type: "page" as ContentItemType,
        visibility: "public" as ContentItemVisibility,
      }

      mockDoc.exists = true
      mockDoc.get.mockResolvedValue({
        exists: true,
        id: "test-id",
        data: () => mockItem,
      })

      const result = await service.getItem("test-id")

      expect(result).toMatchObject({
        id: "test-id",
        ...mockItem,
      })
      expect(mockCollection.doc).toHaveBeenCalledWith("test-id")
    })

    it("should return null for non-existent item", async () => {
      mockDoc.get.mockResolvedValue({
        exists: false,
      })

      const result = await service.getItem("non-existent")

      expect(result).toBeNull()
    })

    it("should handle errors", async () => {
      mockDoc.get.mockRejectedValue(new Error("Database error"))

      await expect(service.getItem("test-id")).rejects.toThrow("Database error")
    })
  })

  describe("createItem", () => {
    it("should create new item", async () => {
      const newItem = {
        title: "New Item",
        type: "page" as ContentItemType,
        visibility: "public" as ContentItemVisibility,
        order: 1,
        userEmail: "test@example.com",
      }

      mockCollection.add.mockResolvedValue({ id: "new-item-id" })

      const result = await service.createItem(newItem)

      expect(result).toBe("new-item-id")
      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          title: newItem.title,
          type: newItem.type,
          visibility: newItem.visibility,
        })
      )
    })

    it("should handle creation errors", async () => {
      mockCollection.add.mockRejectedValue(new Error("Creation failed"))

      const newItem = {
        title: "New Item",
        type: "page" as ContentItemType,
        visibility: "public" as ContentItemVisibility,
        order: 1,
        userEmail: "test@example.com",
      }

      await expect(service.createItem(newItem)).rejects.toThrow("Creation failed")
    })
  })

  describe("updateItem", () => {
    it("should update existing item", async () => {
      const updates = {
        title: "Updated Title",
        userEmail: "test@example.com",
      }

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: "test-id",
        data: () => ({ title: "Old Title" }),
      })

      await service.updateItem("test-id", updates)

      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: updates.title,
        })
      )
    })

    it("should throw error for non-existent item", async () => {
      mockDoc.get.mockResolvedValue({ exists: false })

      await expect(service.updateItem("non-existent", { userEmail: "test@example.com" })).rejects.toThrow()
    })
  })

  describe("deleteItem", () => {
    it("should delete existing item", async () => {
      mockDoc.get.mockResolvedValue({
        exists: true,
        id: "test-id",
      })

      await service.deleteItem("test-id")

      expect(mockDoc.delete).toHaveBeenCalled()
    })

    it("should throw error for non-existent item", async () => {
      mockDoc.get.mockResolvedValue({ exists: false })

      await expect(service.deleteItem("non-existent")).rejects.toThrow()
    })
  })
})
