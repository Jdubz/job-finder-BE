/**
 * Comprehensive Document Generation Pipeline Tests
 * 
 * Tests the complete document generation pipeline to identify 500 errors
 * and ensure all components work correctly.
 */

import { describe, it, expect, beforeEach, afterEach, jest, Mock } from "@jest/globals"
import { manageGenerator } from "../generator"
import type { Request, Response } from "firebase-functions/v2/https"
import { GeneratorService } from "../services/generator.service"
import { ContentItemService } from "../services/content-item.service"
import { PDFService } from "../services/pdf.service"
import { StorageService } from "../services/storage.service"
import { createAIProvider } from "../services/ai-provider.factory"

// Mock all external dependencies
jest.mock("../services/generator.service")
jest.mock("../services/content-item.service")
jest.mock("../services/pdf.service")
jest.mock("../services/storage.service")
jest.mock("../services/ai-provider.factory")
jest.mock("@google-cloud/firestore")
jest.mock("@google-cloud/secret-manager")

describe("Document Generation Pipeline", () => {
  let mockGeneratorService: any
  let mockContentItemService: any
  let mockPDFService: any
  let mockStorageService: any
  let mockAIProvider: any

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Mock GeneratorService
    mockGeneratorService = {
      createRequest: jest.fn(),
      getRequest: jest.fn(),
      updateSteps: jest.fn(),
      updateStatus: jest.fn(),
      getPersonalInfo: jest.fn(),
      updatePersonalInfo: jest.fn(),
    }

    // Mock ContentItemService
    mockContentItemService = {
      getContentItems: jest.fn(),
    }

    // Mock PDFService
    mockPDFService = {
      generateResumePDF: jest.fn(),
      generateCoverLetterPDF: jest.fn(),
    }

    // Mock StorageService
    mockStorageService = {
      uploadFile: jest.fn(),
      getSignedUrl: jest.fn(),
    }

    // Mock AI Provider
    mockAIProvider = {
      generateResume: jest.fn(),
      generateCoverLetter: jest.fn(),
      calculateCost: jest.fn(),
    }

    // Setup default mock implementations
    mockGeneratorService.createRequest.mockResolvedValue({
      id: "test-request-123",
      status: "pending",
      steps: [
        { id: "fetch_data", name: "Fetch Data", status: "pending" },
        { id: "generate_resume", name: "Generate Resume", status: "pending" },
        { id: "create_resume_pdf", name: "Create Resume PDF", status: "pending" },
        { id: "upload_documents", name: "Upload Documents", status: "pending" },
      ],
    })

    mockGeneratorService.getRequest.mockResolvedValue({
      id: "test-request-123",
      status: "pending",
      steps: [
        { id: "fetch_data", name: "Fetch Data", status: "pending" },
        { id: "generate_resume", name: "Generate Resume", status: "pending" },
        { id: "create_resume_pdf", name: "Create Resume PDF", status: "pending" },
        { id: "upload_documents", name: "Upload Documents", status: "pending" },
      ],
    })

    mockGeneratorService.getPersonalInfo.mockResolvedValue({
      name: "Test User",
      email: "test@example.com",
      phone: "555-1234",
      location: "Portland, OR",
      website: "https://test.com",
      github: "https://github.com/test",
      linkedin: "https://linkedin.com/in/test",
      avatar: "https://example.com/avatar.jpg",
      logo: "https://example.com/logo.jpg",
      accentColor: "#3B82F6",
      defaultStyle: "modern",
      aiPrompts: {
        resume: "Generate a professional resume",
        coverLetter: "Generate a professional cover letter",
      },
    })

    mockContentItemService.getContentItems.mockResolvedValue([
      {
        id: "exp-1",
        type: "experience",
        title: "Software Engineer",
        company: "Tech Corp",
        startDate: "2020-01-01",
        endDate: "2023-12-31",
        description: "Built amazing software",
        skills: ["JavaScript", "React", "Node.js"],
      },
    ])

    mockAIProvider.generateResume.mockResolvedValue({
      content: "Generated resume content",
      tokenUsage: { totalTokens: 1000, promptTokens: 800, completionTokens: 200 },
    })

    mockPDFService.generateResumePDF.mockResolvedValue({
      buffer: Buffer.from("PDF content"),
      filename: "resume.pdf",
    })

    mockStorageService.uploadFile.mockResolvedValue({
      url: "https://storage.example.com/resume.pdf",
      filename: "resume.pdf",
    })

    mockStorageService.getSignedUrl.mockResolvedValue("https://storage.example.com/signed-url")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Start Generation", () => {
    it("should successfully start generation with valid request", async () => {
      const req = {
        method: "POST",
        path: "/generator/start",
        body: {
          generateType: "resume",
          job: {
            role: "Software Engineer",
            company: "Tech Corp",
            jobDescriptionText: "Build amazing software",
          },
          preferences: {
            style: "modern",
            emphasize: ["React", "TypeScript"],
          },
        },
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      // Mock the service calls
      mockGeneratorService.createRequest.mockResolvedValue({
        id: "test-request-123",
        status: "pending",
        steps: [
          { id: "fetch_data", name: "Fetch Data", status: "pending" },
          { id: "generate_resume", name: "Generate Resume", status: "pending" },
          { id: "create_resume_pdf", name: "Create Resume PDF", status: "pending" },
          { id: "upload_documents", name: "Upload Documents", status: "pending" },
        ],
      })

      // Call the function
      await manageGenerator(req, res)

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            requestId: expect.any(String),
            nextStep: "fetch_data",
          }),
        })
      )
    })

    it("should handle validation errors gracefully", async () => {
      const req = {
        method: "POST",
        path: "/generator/start",
        body: {
          // Missing required fields
          generateType: "resume",
        },
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "VALIDATION_FAILED",
        })
      )
    })

    it("should handle service errors gracefully", async () => {
      const req = {
        method: "POST",
        path: "/generator/start",
        body: {
          generateType: "resume",
          job: {
            role: "Software Engineer",
            company: "Tech Corp",
            jobDescriptionText: "Build amazing software",
          },
        },
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      // Mock service error
      mockGeneratorService.createRequest.mockRejectedValue(new Error("Database connection failed"))

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "INTERNAL_ERROR",
        })
      )
    })
  })

  describe("Execute Step", () => {
    it("should successfully execute fetch_data step", async () => {
      const req = {
        method: "POST",
        path: "/generator/step/test-request-123",
        body: {},
        rawBody: Buffer.from("{}"),
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      // Mock request with fetch_data as next step
      mockGeneratorService.getRequest.mockResolvedValue({
        id: "test-request-123",
        status: "pending",
        steps: [
          { id: "fetch_data", name: "Fetch Data", status: "pending" },
          { id: "generate_resume", name: "Generate Resume", status: "pending" },
        ],
      })

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            nextStep: "generate_resume",
          }),
        })
      )
    })

    it("should successfully execute generate_resume step", async () => {
      const req = {
        method: "POST",
        path: "/generator/step/test-request-123",
        body: {},
        rawBody: Buffer.from("{}"),
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      // Mock request with generate_resume as next step
      mockGeneratorService.getRequest.mockResolvedValue({
        id: "test-request-123",
        status: "processing",
        steps: [
          { id: "fetch_data", name: "Fetch Data", status: "completed" },
          { id: "generate_resume", name: "Generate Resume", status: "pending" },
          { id: "create_resume_pdf", name: "Create Resume PDF", status: "pending" },
        ],
        intermediateResults: {
          contentItems: [],
        },
      })

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            nextStep: "create_resume_pdf",
          }),
        })
      )
    })

    it("should handle AI provider errors gracefully", async () => {
      const req = {
        method: "POST",
        path: "/generator/step/test-request-123",
        body: {},
        rawBody: Buffer.from("{}"),
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      // Mock request with generate_resume as next step
      mockGeneratorService.getRequest.mockResolvedValue({
        id: "test-request-123",
        status: "processing",
        steps: [
          { id: "fetch_data", name: "Fetch Data", status: "completed" },
          { id: "generate_resume", name: "Generate Resume", status: "pending" },
        ],
        intermediateResults: {
          contentItems: [],
        },
      })

      // Mock AI provider error
      mockAIProvider.generateResume.mockRejectedValue(new Error("AI service unavailable"))

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "STEP_EXECUTION_FAILED",
        })
      )
    })

    it("should handle missing personal info gracefully", async () => {
      const req = {
        method: "POST",
        path: "/generator/step/test-request-123",
        body: {},
        rawBody: Buffer.from("{}"),
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      // Mock request with generate_resume as next step
      mockGeneratorService.getRequest.mockResolvedValue({
        id: "test-request-123",
        status: "processing",
        steps: [
          { id: "fetch_data", name: "Fetch Data", status: "completed" },
          { id: "generate_resume", name: "Generate Resume", status: "pending" },
        ],
        intermediateResults: {
          contentItems: [],
        },
      })

      // Mock missing personal info
      mockGeneratorService.getPersonalInfo.mockResolvedValue(null)

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "STEP_EXECUTION_FAILED",
        })
      )
    })

    it("should handle PDF generation errors gracefully", async () => {
      const req = {
        method: "POST",
        path: "/generator/step/test-request-123",
        body: {},
        rawBody: Buffer.from("{}"),
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      // Mock request with create_resume_pdf as next step
      mockGeneratorService.getRequest.mockResolvedValue({
        id: "test-request-123",
        status: "processing",
        steps: [
          { id: "fetch_data", name: "Fetch Data", status: "completed" },
          { id: "generate_resume", name: "Generate Resume", status: "completed" },
          { id: "create_resume_pdf", name: "Create Resume PDF", status: "pending" },
        ],
        intermediateResults: {
          resumeContent: "Generated resume content",
        },
      })

      // Mock PDF generation error
      mockPDFService.generateResumePDF.mockRejectedValue(new Error("PDF generation failed"))

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "STEP_EXECUTION_FAILED",
        })
      )
    })

    it("should handle storage upload errors gracefully", async () => {
      const req = {
        method: "POST",
        path: "/generator/step/test-request-123",
        body: {},
        rawBody: Buffer.from("{}"),
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      // Mock request with upload_documents as next step
      mockGeneratorService.getRequest.mockResolvedValue({
        id: "test-request-123",
        status: "processing",
        steps: [
          { id: "fetch_data", name: "Fetch Data", status: "completed" },
          { id: "generate_resume", name: "Generate Resume", status: "completed" },
          { id: "create_resume_pdf", name: "Create Resume PDF", status: "completed" },
          { id: "upload_documents", name: "Upload Documents", status: "pending" },
        ],
        intermediateResults: {
          resumePDF: Buffer.from("PDF content"),
        },
      })

      // Mock storage upload error
      mockStorageService.uploadFile.mockRejectedValue(new Error("Storage upload failed"))

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "STEP_EXECUTION_FAILED",
        })
      )
    })
  })

  describe("Complete Pipeline", () => {
    it("should execute complete pipeline successfully", async () => {
      const req = {
        method: "POST",
        path: "/generator/step/test-request-123",
        body: {},
        rawBody: Buffer.from("{}"),
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      // Mock successful pipeline execution
      mockGeneratorService.getRequest
        .mockResolvedValueOnce({
          id: "test-request-123",
          status: "processing",
          steps: [
            { id: "fetch_data", name: "Fetch Data", status: "pending" },
            { id: "generate_resume", name: "Generate Resume", status: "pending" },
            { id: "create_resume_pdf", name: "Create Resume PDF", status: "pending" },
            { id: "upload_documents", name: "Upload Documents", status: "pending" },
          ],
        })
        .mockResolvedValueOnce({
          id: "test-request-123",
          status: "processing",
          steps: [
            { id: "fetch_data", name: "Fetch Data", status: "completed" },
            { id: "generate_resume", name: "Generate Resume", status: "pending" },
            { id: "create_resume_pdf", name: "Create Resume PDF", status: "pending" },
            { id: "upload_documents", name: "Upload Documents", status: "pending" },
          ],
          intermediateResults: {
            contentItems: [],
          },
        })
        .mockResolvedValueOnce({
          id: "test-request-123",
          status: "processing",
          steps: [
            { id: "fetch_data", name: "Fetch Data", status: "completed" },
            { id: "generate_resume", name: "Generate Resume", status: "completed" },
            { id: "create_resume_pdf", name: "Create Resume PDF", status: "pending" },
            { id: "upload_documents", name: "Upload Documents", status: "pending" },
          ],
          intermediateResults: {
            resumeContent: "Generated resume content",
          },
        })
        .mockResolvedValueOnce({
          id: "test-request-123",
          status: "processing",
          steps: [
            { id: "fetch_data", name: "Fetch Data", status: "completed" },
            { id: "generate_resume", name: "Generate Resume", status: "completed" },
            { id: "create_resume_pdf", name: "Create Resume PDF", status: "completed" },
            { id: "upload_documents", name: "Upload Documents", status: "pending" },
          ],
          intermediateResults: {
            resumePDF: Buffer.from("PDF content"),
          },
        })
        .mockResolvedValueOnce({
          id: "test-request-123",
          status: "completed",
          steps: [
            { id: "fetch_data", name: "Fetch Data", status: "completed" },
            { id: "generate_resume", name: "Generate Resume", status: "completed" },
            { id: "create_resume_pdf", name: "Create Resume PDF", status: "completed" },
            { id: "upload_documents", name: "Upload Documents", status: "completed" },
          ],
          resumeUrl: "https://storage.example.com/resume.pdf",
        })

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: "completed",
            resumeUrl: "https://storage.example.com/resume.pdf",
          }),
        })
      )
    })
  })

  describe("Error Scenarios", () => {
    it("should handle database connection errors", async () => {
      const req = {
        method: "POST",
        path: "/generator/step/test-request-123",
        body: {},
        rawBody: Buffer.from("{}"),
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      // Mock database error
      mockGeneratorService.getRequest.mockRejectedValue(new Error("Database connection failed"))

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "INTERNAL_ERROR",
        })
      )
    })

    it("should handle missing request ID", async () => {
      const req = {
        method: "POST",
        path: "/generator/step/",
        body: {},
        rawBody: Buffer.from("{}"),
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "VALIDATION_FAILED",
        })
      )
    })

    it("should handle non-existent request", async () => {
      const req = {
        method: "POST",
        path: "/generator/step/non-existent-request",
        body: {},
        rawBody: Buffer.from("{}"),
      } as Request

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response

      // Mock non-existent request
      mockGeneratorService.getRequest.mockResolvedValue(null)

      await manageGenerator(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "NOT_FOUND",
        })
      )
    })
  })
})
