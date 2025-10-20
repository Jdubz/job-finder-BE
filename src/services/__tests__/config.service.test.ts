/**
 * ConfigService Tests
 *
 * Tests for configuration management service including stop lists,
 * AI settings, and queue settings.
 */

import { ConfigService } from "../config.service";

// Mock Firestore
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDoc = jest.fn(() => ({
  get: mockGet,
  set: mockSet,
}));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
}));

jest.mock("../../config/firestore", () => ({
  createFirestoreInstance: jest.fn(() => ({
    collection: mockCollection,
  })),
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe("ConfigService", () => {
  let configService: ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = new ConfigService(mockLogger as any);
  });

  describe("Stop List", () => {
    describe("getStopList", () => {
      it("should return stop list from Firestore", async () => {
        const mockStopList = {
          excludedCompanies: ["Bad Company"],
          excludedKeywords: ["unpaid"],
          excludedDomains: ["spam.com"],
          updatedAt: "2024-01-01T00:00:00Z",
          updatedBy: "editor@test.com",
        };

        mockGet.mockResolvedValue({
          exists: true,
          data: () => mockStopList,
        });

        const result = await configService.getStopList();

        expect(result).toEqual(mockStopList);
        expect(mockCollection).toHaveBeenCalledWith("job-finder-config");
        expect(mockDoc).toHaveBeenCalledWith("stop-list");
      });

      it("should return default stop list when not found", async () => {
        mockGet.mockResolvedValue({
          exists: false,
        });

        const result = await configService.getStopList();

        expect(result).toEqual({
          excludedCompanies: [],
          excludedKeywords: [],
          excludedDomains: [],
        });
        expect(mockLogger.info).toHaveBeenCalledWith(
          "Stop list not found, returning defaults"
        );
      });

      it("should throw error on Firestore failure", async () => {
        mockGet.mockRejectedValue(new Error("Firestore error"));

        await expect(configService.getStopList()).rejects.toThrow(
          "Failed to retrieve stop list configuration"
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe("updateStopList", () => {
      it("should update stop list with audit trail", async () => {
        const stopList = {
          excludedCompanies: ["Bad Company"],
          excludedKeywords: ["unpaid"],
          excludedDomains: ["spam.com"],
        };
        const updatedBy = "editor@test.com";

        await configService.updateStopList(stopList, updatedBy);

        expect(mockSet).toHaveBeenCalledWith(
          expect.objectContaining({
            ...stopList,
            updatedBy,
            updatedAt: expect.any(String),
          }),
          { merge: true }
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          "Stop list updated",
          expect.objectContaining({ updatedBy })
        );
      });

      it("should throw error on update failure", async () => {
        mockSet.mockRejectedValue(new Error("Update failed"));

        await expect(
          configService.updateStopList({}, "test@test.com")
        ).rejects.toThrow("Failed to update stop list configuration");
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe("checkStopList", () => {
      beforeEach(() => {
        mockGet.mockResolvedValue({
          exists: true,
          data: () => ({
            excludedCompanies: ["Bad Company", "Scam Corp"],
            excludedKeywords: ["unpaid", "commission"],
            excludedDomains: ["spam.com", "scam.net"],
          }),
        });
      });

      it("should detect excluded domain", async () => {
        const result = await configService.checkStopList(
          "Test Company",
          "https://spam.com/job"
        );

        expect(result).toEqual({
          isExcluded: true,
          reason: "domain",
        });
      });

      it("should detect excluded company", async () => {
        const result = await configService.checkStopList(
          "Bad Company",
          "https://example.com/job"
        );

        expect(result).toEqual({
          isExcluded: true,
          reason: "company",
        });
      });

      it("should detect excluded keyword", async () => {
        const result = await configService.checkStopList(
          "Great Unpaid Internship",
          "https://example.com/job"
        );

        expect(result).toEqual({
          isExcluded: true,
          reason: "keyword",
        });
      });

      it("should not exclude valid company", async () => {
        const result = await configService.checkStopList(
          "Good Company",
          "https://example.com/job"
        );

        expect(result).toEqual({
          isExcluded: false,
          reason: null,
        });
      });

      it("should handle invalid URL gracefully", async () => {
        const result = await configService.checkStopList(
          "Good Company",
          "not-a-url"
        );

        expect(result).toEqual({
          isExcluded: false,
          reason: null,
        });
        expect(mockLogger.warning).toHaveBeenCalled();
      });

      it("should fail open on error", async () => {
        mockGet.mockRejectedValue(new Error("Database error"));

        const result = await configService.checkStopList(
          "Test Company",
          "https://example.com/job"
        );

        expect(result).toEqual({
          isExcluded: false,
          reason: null,
        });
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it("should be case-insensitive for company names", async () => {
        const result = await configService.checkStopList(
          "bad company",
          "https://example.com/job"
        );

        expect(result.isExcluded).toBe(true);
        expect(result.reason).toBe("company");
      });

      it("should strip www from domain", async () => {
        const result = await configService.checkStopList(
          "Test Company",
          "https://www.spam.com/job"
        );

        expect(result).toEqual({
          isExcluded: true,
          reason: "domain",
        });
      });
    });
  });

  describe("AI Settings", () => {
    describe("getAISettings", () => {
      it("should return AI settings from Firestore", async () => {
        const mockSettings = {
          provider: "claude" as const,
          model: "claude-3-5-sonnet-20241022",
          minMatchScore: 75,
          costBudgetDaily: 15.0,
          updatedAt: "2024-01-01T00:00:00Z",
          updatedBy: "editor@test.com",
        };

        mockGet.mockResolvedValue({
          exists: true,
          data: () => mockSettings,
        });

        const result = await configService.getAISettings();

        expect(result).toEqual(mockSettings);
        expect(mockDoc).toHaveBeenCalledWith("ai-settings");
      });

      it("should return default AI settings when not found", async () => {
        mockGet.mockResolvedValue({
          exists: false,
        });

        const result = await configService.getAISettings();

        expect(result.provider).toBe("claude");
        expect(result.model).toBe("claude-3-5-sonnet-20241022");
        expect(mockLogger.info).toHaveBeenCalledWith(
          "AI settings not found, returning defaults"
        );
      });
    });

    describe("updateAISettings", () => {
      it("should update AI settings with audit trail", async () => {
        mockSet.mockResolvedValue(undefined);

        const settings = {
          provider: "openai" as const,
          model: "gpt-4",
          minMatchScore: 80,
          costBudgetDaily: 20.0,
        };
        const updatedBy = "editor@test.com";

        await configService.updateAISettings(settings, updatedBy);

        expect(mockSet).toHaveBeenCalledWith(
          expect.objectContaining({
            ...settings,
            updatedBy,
            updatedAt: expect.any(String),
          }),
          { merge: true }
        );
      });
    });
  });

  describe("Queue Settings", () => {
    describe("getQueueSettings", () => {
      it("should return queue settings from Firestore", async () => {
        const mockSettings = {
          maxRetries: 5,
          retryDelaySeconds: 600,
          processingTimeout: 7200,
          updatedAt: "2024-01-01T00:00:00Z",
          updatedBy: "editor@test.com",
        };

        mockGet.mockResolvedValue({
          exists: true,
          data: () => mockSettings,
        });

        const result = await configService.getQueueSettings();

        expect(result).toEqual(mockSettings);
        expect(mockDoc).toHaveBeenCalledWith("queue-settings");
      });

      it("should return default queue settings when not found", async () => {
        mockGet.mockResolvedValue({
          exists: false,
        });

        const result = await configService.getQueueSettings();

        expect(result.maxRetries).toBe(3);
        expect(result.retryDelaySeconds).toBe(300);
        expect(result.processingTimeout).toBe(3600);
      });
    });

    describe("updateQueueSettings", () => {
      it("should update queue settings with audit trail", async () => {
        mockSet.mockResolvedValue(undefined);

        const settings = {
          maxRetries: 5,
          retryDelaySeconds: 600,
          processingTimeout: 7200,
        };
        const updatedBy = "editor@test.com";

        await configService.updateQueueSettings(settings, updatedBy);

        expect(mockSet).toHaveBeenCalledWith(
          expect.objectContaining({
            ...settings,
            updatedBy,
            updatedAt: expect.any(String),
          }),
          { merge: true }
        );
      });
    });
  });
});
