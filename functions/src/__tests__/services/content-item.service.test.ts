import { describe, it, expect, beforeEach, vi, Mock } from "vitest"
import { ContentItemService } from "../../services/content-item.service"
import { Timestamp } from "@google-cloud/firestore"
import type { CreateContentItemData, UpdateContentItemData } from "../../types/content-item.types"

vi.mock("../../config/firestore", () => ({
  createFirestoreInstance: vi.fn(),
}))

vi.mock("../../utils/logger", () => ({
  createDefaultLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe("ContentItemService", () => {
  let service: ContentItemService
  let mockDb: any
  let mockCollection: any
  let mockDoc: any
  let mockQuery: any

  beforeEach(() => {
    mockDoc = {
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      set: vi.fn(),
    }

    mockQuery = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn(),
    }

    mockCollection = {
      doc: vi.fn().mockReturnValue(mockDoc),
      add: vi.fn(),
      where: vi.fn().mockReturnValue(mockQuery),
      orderBy: vi.fn().mockReturnValue(mockQuery),
      get: vi.fn(),
    }

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection),
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createFirestoreInstance } = require("../../config/firestore")
    ;(createFirestoreInstance as Mock).mockReturnValue(mockDb)

    service = new ContentItemService()
  })

  describe("getItem", () => {
    it("should return a content item by id", async () => {
      const mockItem = {
        type: "skill",
        title: "JavaScript",
        order: 1,
        visibility: "published",
        parentId: null,
      }

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: "item-123",
        data: () => mockItem,
      })

      const result = await service.getItem("item-123")

      expect(result).toEqual({
        id: "item-123",
        ...mockItem,
      })
      expect(mockCollection.doc).toHaveBeenCalledWith("item-123")
    })

    it("should return null when item does not exist", async () => {
      mockDoc.get.mockResolvedValue({
        exists: false,
      })

      const result = await service.getItem("nonexistent")

      expect(result).toBeNull()
    })

    it("should throw error on database failure", async () => {
      mockDoc.get.mockRejectedValue(new Error("Database error"))

      await expect(service.getItem("item-123")).rejects.toThrow("Database error")
    })
  })

  describe("createItem", () => {
    it("should create a new content item", async () => {
      const newItem: CreateContentItemData = {
        type: "skill",
        title: "TypeScript",
        order: 1,
        visibility: "published",
        parentId: null,
      }

      const mockDocRef = { id: "new-item-123" }
      mockCollection.add.mockResolvedValue(mockDocRef)

      const result = await service.createItem(newItem, "user@example.com")

      expect(result.id).toBe("new-item-123")
      expect(result.title).toBe("TypeScript")
      expect(result.createdBy).toBe("user@example.com")
      expect(result.updatedBy).toBe("user@example.com")
      expect(result.createdAt).toBeInstanceOf(Timestamp)
      expect(result.updatedAt).toBeInstanceOf(Timestamp)

      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "skill",
          title: "TypeScript",
          createdBy: "user@example.com",
          updatedBy: "user@example.com",
        })
      )
    })

    it("should set default visibility to published", async () => {
      const newItem: CreateContentItemData = {
        type: "skill",
        title: "Python",
        order: 1,
        parentId: null,
      }

      mockCollection.add.mockResolvedValue({ id: "new-item-456" })

      const result = await service.createItem(newItem, "user@example.com")

      expect(result.visibility).toBe("published")
    })

    it("should handle parentId correctly", async () => {
      const newItem: CreateContentItemData = {
        type: "skill",
        title: "React",
        order: 1,
        parentId: "parent-123",
      }

      mockCollection.add.mockResolvedValue({ id: "new-item-789" })

      const result = await service.createItem(newItem, "user@example.com")

      expect(result.parentId).toBe("parent-123")
    })
  })

  describe("updateItem", () => {
    it("should update an existing content item", async () => {
      const existingItem = {
        type: "skill",
        title: "JavaScript",
        order: 1,
        visibility: "published",
      }

      mockDoc.get
        .mockResolvedValueOnce({
          exists: true,
          id: "item-123",
          data: () => existingItem,
        })
        .mockResolvedValueOnce({
          exists: true,
          id: "item-123",
          data: () => ({
            ...existingItem,
            title: "Advanced JavaScript",
          }),
        })

      const updates: UpdateContentItemData = {
        title: "Advanced JavaScript",
      }

      const result = await service.updateItem("item-123", updates, "user@example.com")

      expect(result.title).toBe("Advanced JavaScript")
      expect(result.updatedBy).toBe("user@example.com")
      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Advanced JavaScript",
          updatedBy: "user@example.com",
        })
      )
    })

    it("should throw error when item does not exist", async () => {
      mockDoc.get.mockResolvedValue({
        exists: false,
      })

      await expect(service.updateItem("nonexistent", {}, "user@example.com")).rejects.toThrow(
        "Content item not found"
      )
    })

    it("should filter out undefined values", async () => {
      mockDoc.get
        .mockResolvedValueOnce({
          exists: true,
          id: "item-123",
          data: () => ({ title: "Test" }),
        })
        .mockResolvedValueOnce({
          exists: true,
          id: "item-123",
          data: () => ({ title: "Test" }),
        })

      const updates: UpdateContentItemData = {
        title: "New Title",
        description: undefined,
      }

      await service.updateItem("item-123", updates, "user@example.com")

      const updateCall = mockDoc.update.mock.calls[0][0]
      expect(updateCall.title).toBe("New Title")
      expect("description" in updateCall).toBe(false)
    })
  })

  describe("deleteItem", () => {
    it("should delete an existing content item", async () => {
      mockDoc.get.mockResolvedValue({
        exists: true,
        id: "item-123",
        data: () => ({ title: "Test" }),
      })

      await service.deleteItem("item-123")

      expect(mockDoc.delete).toHaveBeenCalled()
    })

    it("should throw error when item does not exist", async () => {
      mockDoc.get.mockResolvedValue({
        exists: false,
      })

      await expect(service.deleteItem("nonexistent")).rejects.toThrow("Content item not found")
    })
  })

  describe("listItems", () => {
    it("should list all items with no filters", async () => {
      const mockItems = [
        { id: "1", title: "Item 1", type: "skill" },
        { id: "2", title: "Item 2", type: "skill" },
      ]

      mockQuery.get.mockResolvedValue({
        docs: mockItems.map((item) => ({
          id: item.id,
          data: () => ({ title: item.title, type: item.type }),
        })),
      })

      const result = await service.listItems()

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe("Item 1")
      expect(result[1].title).toBe("Item 2")
    })

    it("should filter items by type", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [
          {
            id: "1",
            data: () => ({ title: "TypeScript", type: "skill" }),
          },
        ],
      })

      const result = await service.listItems({ type: "skill" })

      expect(result).toHaveLength(1)
      expect(mockQuery.where).toHaveBeenCalledWith("type", "==", "skill")
    })

    it("should filter items by parentId", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [
          {
            id: "1",
            data: () => ({ title: "Child", parentId: "parent-123" }),
          },
        ],
      })

      const result = await service.listItems({ parentId: "parent-123" })

      expect(result).toHaveLength(1)
      expect(mockQuery.where).toHaveBeenCalledWith("parentId", "==", "parent-123")
    })

    it("should limit results", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [
          { id: "1", data: () => ({ title: "Item 1" }) },
          { id: "2", data: () => ({ title: "Item 2" }) },
        ],
      })

      await service.listItems({ limit: 2 })

      expect(mockQuery.limit).toHaveBeenCalledWith(2)
    })
  })

  describe("getRootItems", () => {
    it("should get items with no parent", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [
          {
            id: "1",
            data: () => ({ title: "Root Item", parentId: null }),
          },
        ],
      })

      const result = await service.getRootItems()

      expect(result).toHaveLength(1)
      expect(mockQuery.where).toHaveBeenCalledWith("parentId", "==", null)
    })
  })

  describe("getChildren", () => {
    it("should get children of a parent item", async () => {
      mockQuery.get.mockResolvedValue({
        docs: [
          {
            id: "1",
            data: () => ({ title: "Child", parentId: "parent-123" }),
          },
        ],
      })

      const result = await service.getChildren("parent-123")

      expect(result).toHaveLength(1)
      expect(mockQuery.where).toHaveBeenCalledWith("parentId", "==", "parent-123")
    })
  })
})
