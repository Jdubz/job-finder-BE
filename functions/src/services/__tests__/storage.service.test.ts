import { StorageService } from "../storage.service"

// Mock Storage
jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn(() => ({
    bucket: jest.fn(),
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

describe("StorageService", () => {
  let service: StorageService
  let mockBucket: Record<string, jest.Mock>
  let mockFile: Record<string, jest.Mock>
  let mockStorage: Record<string, jest.Mock>

  beforeEach(async () => {
    jest.clearAllMocks()

    mockFile = {
      save: jest.fn().mockResolvedValue(undefined),
      download: jest.fn().mockResolvedValue([Buffer.from("test content")]),
      delete: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue([true]),
      getSignedUrl: jest.fn().mockResolvedValue(["https://example.com/signed-url"]),
      makePublic: jest.fn().mockResolvedValue(undefined),
      makePrivate: jest.fn().mockResolvedValue(undefined),
    }

    mockBucket = {
      file: jest.fn().mockReturnValue(mockFile),
      upload: jest.fn().mockResolvedValue([mockFile]),
      getFiles: jest.fn().mockResolvedValue([[]]),
    }

    mockStorage = {
      bucket: jest.fn().mockReturnValue(mockBucket),
    }

    const storageModule = await import("@google-cloud/storage")
    const Storage = storageModule.Storage as jest.MockedClass<typeof storageModule.Storage>
    Storage.mockImplementation(() => mockStorage)

    service = new StorageService()
  })

  describe("uploadFile", () => {
    it("should upload file successfully", async () => {
      const buffer = Buffer.from("test content")
      const destination = "test/file.txt"
      const contentType = "text/plain"

      const result = await service.uploadFile(buffer, destination, contentType)

      expect(result).toBe(destination)
      expect(mockFile.save).toHaveBeenCalledWith(buffer, {
        contentType,
        metadata: expect.any(Object),
      })
    })

    it("should handle upload errors", async () => {
      mockFile.save.mockRejectedValue(new Error("Upload failed"))

      const buffer = Buffer.from("test content")

      await expect(service.uploadFile(buffer, "test/file.txt")).rejects.toThrow("Upload failed")
    })
  })

  describe("downloadFile", () => {
    it("should download file successfully", async () => {
      const result = await service.downloadFile("test/file.txt")

      expect(result).toBeInstanceOf(Buffer)
      expect(mockFile.download).toHaveBeenCalled()
    })

    it("should handle download errors", async () => {
      mockFile.download.mockRejectedValue(new Error("Download failed"))

      await expect(service.downloadFile("test/file.txt")).rejects.toThrow("Download failed")
    })
  })

  describe("deleteFile", () => {
    it("should delete file successfully", async () => {
      await service.deleteFile("test/file.txt")

      expect(mockFile.delete).toHaveBeenCalled()
    })

    it("should handle delete errors", async () => {
      mockFile.delete.mockRejectedValue(new Error("Delete failed"))

      await expect(service.deleteFile("test/file.txt")).rejects.toThrow("Delete failed")
    })
  })

  describe("fileExists", () => {
    it("should check if file exists", async () => {
      mockFile.exists.mockResolvedValue([true])

      const result = await service.fileExists("test/file.txt")

      expect(result).toBe(true)
      expect(mockFile.exists).toHaveBeenCalled()
    })

    it("should return false for non-existent file", async () => {
      mockFile.exists.mockResolvedValue([false])

      const result = await service.fileExists("non-existent.txt")

      expect(result).toBe(false)
    })
  })

  describe("getSignedUrl", () => {
    it("should generate signed URL", async () => {
      const result = await service.getSignedUrl("test/file.txt", {
        action: "read",
        expires: Date.now() + 3600000,
      })

      expect(result).toBe("https://example.com/signed-url")
      expect(mockFile.getSignedUrl).toHaveBeenCalled()
    })

    it("should handle signed URL errors", async () => {
      mockFile.getSignedUrl.mockRejectedValue(new Error("Signing failed"))

      await expect(
        service.getSignedUrl("test/file.txt", {
          action: "read",
          expires: Date.now() + 3600000,
        })
      ).rejects.toThrow("Signing failed")
    })
  })
})
