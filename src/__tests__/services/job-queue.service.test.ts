/**
 * Unit Tests for JobQueueService
 * 
 * Tests all job queue service methods in isolation with mocked dependencies.
 */

import { JobQueueService } from '../../services/job-queue.service';
import { createMockLogger, createMockDocRef, createMockCollectionRef } from '../helpers/test-utils';
import type { QueueSettings, StopList } from '../../types/job-queue.types';

// Create mocks outside before describe block
let mockDb: any;
let mockCollection: any;
let mockDocRef: any;

// Mock Firestore configuration
jest.mock('../../config/firestore', () => ({
  createFirestoreInstance: jest.fn(() => mockDb),
}));

describe('JobQueueService', () => {
  let service: JobQueueService;
  let mockLogger: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = createMockLogger();

    // Create mock Firestore references
    mockDocRef = createMockDocRef('test-queue-item-123');
    mockCollection = createMockCollectionRef();
    mockCollection.add.mockResolvedValue(mockDocRef);

    // Create mock Firestore instance
    mockDb = {
      collection: jest.fn(() => mockCollection),
      doc: jest.fn(() => mockDocRef),
    };

    // Create service instance
    service = new JobQueueService(mockLogger);
  });

  describe('submitJob', () => {
    const mockQueueSettings: QueueSettings = {
      maxRetries: 3,
      retryDelaySeconds: 300,
      processingTimeout: 600,
    };

    beforeEach(() => {
      // Mock getQueueSettings
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => mockQueueSettings,
      });
    });

    it('should submit a job successfully with all required fields', async () => {
      const url = 'https://example.com/job/123';
      const companyName = 'Test Company';
      const userId = 'user-123';

      const result = await service.submitJob(url, companyName, userId);

      expect(result).toHaveProperty('id', 'test-queue-item-123');
      expect(result).toHaveProperty('type', 'job');
      expect(result).toHaveProperty('status', 'pending');
      expect(result).toHaveProperty('url', url);
      expect(result).toHaveProperty('company_name', companyName);
      expect(result).toHaveProperty('submitted_by', userId);
      expect(result).toHaveProperty('max_retries', 3);
      expect(result).toHaveProperty('retry_count', 0);

      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'job',
          status: 'pending',
          url,
          company_name: companyName,
          submitted_by: userId,
        })
      );
    });

    it('should handle anonymous job submission (null userId)', async () => {
      const url = 'https://example.com/job/456';
      const companyName = 'Anonymous Company';

      const result = await service.submitJob(url, companyName, null);

      expect(result.submitted_by).toBeNull();
      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          submitted_by: null,
        })
      );
    });

    it('should handle empty company name', async () => {
      const url = 'https://example.com/job/789';

      const result = await service.submitJob(url, undefined, 'user-123');

      expect(result.company_name).toBe('');
    });

    it('should mark job as success when generationId is provided', async () => {
      const url = 'https://example.com/job/pre-generated';
      const generationId = 'gen-123';

      const result = await service.submitJob(url, 'Company', 'user-123', generationId);

      expect(result.status).toBe('success');
      expect(result).toHaveProperty('result_message', 'Documents already generated via Document Builder');
      expect(result).toHaveProperty('metadata');
      expect((result as any).metadata).toHaveProperty('generationId', generationId);
      expect((result as any).metadata).toHaveProperty('documentsPreGenerated', true);
    });

    it('should log successful submission', async () => {
      await service.submitJob('https://example.com', 'Company', 'user-123');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Job submitted to queue',
        expect.objectContaining({
          queueItemId: 'test-queue-item-123',
          url: 'https://example.com',
          userId: 'user-123',
        })
      );
    });

    it('should log and throw error on failure', async () => {
      const error = new Error('Firestore error');
      mockCollection.add.mockRejectedValue(error);

      await expect(
        service.submitJob('https://example.com', 'Company', 'user-123')
      ).rejects.toThrow('Firestore error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to submit job to queue',
        expect.objectContaining({
          error,
          url: 'https://example.com',
          userId: 'user-123',
        })
      );
    });
  });

  describe('submitCompany', () => {
    const mockQueueSettings: QueueSettings = {
      maxRetries: 3,
      retryDelaySeconds: 300,
      processingTimeout: 600,
    };

    beforeEach(() => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => mockQueueSettings,
      });
    });

    it('should submit a company successfully', async () => {
      const companyName = 'Tech Corp';
      const websiteUrl = 'https://techcorp.com';
      const source = 'manual_submission';
      const userId = 'user-456';

      const result = await service.submitCompany(companyName, websiteUrl, source, userId);

      expect(result).toHaveProperty('id', 'test-queue-item-123');
      expect(result).toHaveProperty('type', 'company');
      expect(result).toHaveProperty('status', 'pending');
      expect(result).toHaveProperty('company_name', companyName);
      expect(result).toHaveProperty('url', websiteUrl);
      expect(result).toHaveProperty('source', source);
      expect(result).toHaveProperty('company_sub_task', 'fetch');
    });

    it('should handle null userId for company submission', async () => {
      const result = await service.submitCompany(
        'Company',
        'https://company.com',
        'automated_scan',
        null
      );

      expect(result.submitted_by).toBeNull();
    });
  });

  describe('submitScrape', () => {
    const mockQueueSettings: QueueSettings = {
      maxRetries: 3,
      retryDelaySeconds: 300,
      processingTimeout: 600,
    };

    beforeEach(() => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => mockQueueSettings,
      });
    });

    it('should submit scrape request with default config', async () => {
      const userId = 'user-789';

      const result = await service.submitScrape(userId);

      expect(result).toHaveProperty('type', 'scrape');
      expect(result).toHaveProperty('status', 'pending');
      expect(result).toHaveProperty('scrape_config');
      expect(result.scrape_config).toEqual({
        target_matches: 5,
        max_sources: 20,
      });
    });

    it('should submit scrape request with custom config', async () => {
      const userId = 'user-789';
      const scrapeConfig = {
        target_matches: 10,
        max_sources: 50,
        source_ids: ['source-1', 'source-2'],
        min_match_score: 75,
      };

      const result = await service.submitScrape(userId, scrapeConfig);

      expect(result.scrape_config).toEqual(scrapeConfig);
    });
  });

  // Note: getQueueItem method doesn't exist in current implementation
  // Skipping these tests for now

  describe('getQueueSettings', () => {
    it('should return queue settings from Firestore', async () => {
      const mockSettings: QueueSettings = {
        maxRetries: 5,
        retryDelaySeconds: 600,
        processingTimeout: 1200,
      };

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => mockSettings,
      });

      const result = await service.getQueueSettings();

      expect(result).toEqual(mockSettings);
    });

    it('should return default settings if not found', async () => {
      mockDocRef.get.mockResolvedValue({
        exists: false,
      });

      const result = await service.getQueueSettings();

      expect(result).toEqual({
        maxRetries: 3,
        retryDelaySeconds: 300,
        processingTimeout: 600,
      });
    });
  });

  describe('getStopList', () => {
    it('should return stop list from Firestore', async () => {
      const mockStopList: StopList = {
        excludedCompanies: ['Bad Corp', 'Evil Inc'],
        excludedKeywords: ['scam', 'pyramid'],
        excludedDomains: ['badsite.com', 'scam.net'],
      };

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => mockStopList,
      });

      const result = await service.getStopList();

      expect(result).toEqual(mockStopList);
    });

    it('should return default empty stop list if not found', async () => {
      mockDocRef.get.mockResolvedValue({
        exists: false,
      });

      const result = await service.getStopList();

      expect(result).toEqual({
        excludedCompanies: [],
        excludedKeywords: [],
        excludedDomains: [],
      });
    });
  });

  describe('checkStopList', () => {
    beforeEach(() => {
      const mockStopList: StopList = {
        excludedCompanies: ['Bad Corp', 'Evil Inc'],
        excludedKeywords: ['scam', 'pyramid'],
        excludedDomains: ['badsite.com', 'scam.net'],
      };

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => mockStopList,
      });
    });

    it('should allow companies not in stop list', async () => {
      const result = await service.checkStopList('Good Company', 'https://goodcompany.com');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block excluded domain', async () => {
      const result = await service.checkStopList('Any Company', 'https://www.badsite.com/jobs');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('domain');
    });

    it('should block excluded company name', async () => {
      const result = await service.checkStopList('Bad Corp LLC', 'https://anydomain.com');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('company');
    });

    it('should block excluded keyword in company name', async () => {
      const result = await service.checkStopList('Pyramid Schemes Inc', 'https://anydomain.com');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('keyword');
    });

    it('should be case insensitive', async () => {
      const result = await service.checkStopList('EVIL INC', 'https://BADSITE.COM');

      expect(result.allowed).toBe(false);
    });

    it('should fail open (allow) on error', async () => {
      mockDocRef.get.mockRejectedValue(new Error('Firestore error'));

      const result = await service.checkStopList('Any Company', 'https://anysite.com');

      expect(result.allowed).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
