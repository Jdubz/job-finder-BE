/**
 * Unit Tests for FirestoreService
 * 
 * Tests Firestore service methods for contact submission handling.
 */

import { FirestoreService } from '../../services/firestore.service';
import { createMockLogger, createMockDocRef, createMockCollectionRef } from '../helpers/test-utils';

// Create mocks outside before describe block
let mockDb: any;
let mockCollection: any;
let mockDocRef: any;

// Mock Firestore configuration
jest.mock('../../config/firestore', () => ({
  createFirestoreInstance: jest.fn(() => mockDb),
}));

describe('FirestoreService', () => {
  let service: FirestoreService;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = createMockLogger();
    mockDocRef = createMockDocRef('test-submission-123');
    mockCollection = createMockCollectionRef();
    mockCollection.add.mockResolvedValue(mockDocRef);

    mockDb = {
      collection: jest.fn(() => mockCollection),
    };

    service = new FirestoreService(mockLogger);
  });

  describe('saveContactSubmission', () => {
    it('should save a complete contact submission successfully', async () => {
      const submissionData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
        metadata: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date().toISOString(),
          referrer: 'https://example.com',
        },
        requestId: 'req-123',
        traceId: 'trace-456',
        spanId: 'span-789',
        transaction: {
          contactEmail: {
            success: true,
            response: {
              messageId: 'msg-123',
              accepted: true,
            },
          },
          autoReply: {
            success: true,
            response: {
              messageId: 'msg-456',
              accepted: true,
            },
          },
          errors: [],
        },
      };

      const docId = await service.saveContactSubmission(submissionData);

      expect(docId).toBe('test-submission-123');
      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          message: 'Test message',
          status: 'new',
          requestId: 'req-123',
          traceId: 'trace-456',
          spanId: 'span-789',
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Contact submission saved to Firestore',
        expect.objectContaining({
          docId: 'test-submission-123',
          requestId: 'req-123',
        })
      );
    });

    it('should handle submission with minimal metadata', async () => {
      const submissionData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        message: 'Another test',
        metadata: {
          timestamp: new Date().toISOString(),
        },
        requestId: 'req-456',
        transaction: {
          contactEmail: {
            success: false,
            error: 'Email failed',
            errorCode: 'SMTP_ERROR',
          },
          autoReply: {
            success: false,
            error: 'Auto-reply failed',
          },
          errors: ['Email sending failed'],
        },
      };

      const docId = await service.saveContactSubmission(submissionData);

      expect(docId).toBe('test-submission-123');
      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Jane Smith',
          email: 'jane@example.com',
          status: 'new',
        })
      );
    });

    it('should clean undefined values from metadata', async () => {
      const submissionData = {
        name: 'Test User',
        email: 'test@example.com',
        message: 'Test',
        metadata: {
          timestamp: new Date().toISOString(),
          ip: undefined,
          userAgent: undefined,
          referrer: undefined,
        },
        requestId: 'req-789',
        transaction: {
          contactEmail: { success: true },
          autoReply: { success: true },
          errors: [],
        },
      };

      await service.saveContactSubmission(submissionData);

      const savedData = mockCollection.add.mock.calls[0][0];
      expect(savedData.metadata).toHaveProperty('timestamp');
      expect(savedData.metadata).not.toHaveProperty('ip');
      expect(savedData.metadata).not.toHaveProperty('userAgent');
      expect(savedData.metadata).not.toHaveProperty('referrer');
    });

    it('should handle transaction errors array', async () => {
      const submissionData = {
        name: 'Error Test',
        email: 'error@example.com',
        message: 'Error test message',
        metadata: {
          timestamp: new Date().toISOString(),
        },
        requestId: 'req-error',
        transaction: {
          contactEmail: {
            success: false,
            error: 'Failed',
            errorCode: 'ERR_001',
          },
          autoReply: {
            success: false,
            error: 'Failed',
          },
          errors: ['Error 1', 'Error 2', 'Error 3'],
        },
      };

      await service.saveContactSubmission(submissionData);

      const savedData = mockCollection.add.mock.calls[0][0];
      expect(savedData.transaction.errors).toEqual(['Error 1', 'Error 2', 'Error 3']);
    });

    it('should set status to "new" and add timestamps', async () => {
      const submissionData = {
        name: 'Status Test',
        email: 'status@example.com',
        message: 'Status test',
        metadata: {
          timestamp: new Date().toISOString(),
        },
        requestId: 'req-status',
        transaction: {
          contactEmail: { success: true },
          autoReply: { success: true },
          errors: [],
        },
      };

      await service.saveContactSubmission(submissionData);

      const savedData = mockCollection.add.mock.calls[0][0];
      expect(savedData.status).toBe('new');
      expect(savedData).toHaveProperty('createdAt');
      expect(savedData).toHaveProperty('updatedAt');
      expect(savedData.createdAt).toBeInstanceOf(Date);
      expect(savedData.updatedAt).toBeInstanceOf(Date);
    });

    it('should log and throw error on failure', async () => {
      const error = new Error('Firestore write failed');
      mockCollection.add.mockRejectedValue(error);

      const submissionData = {
        name: 'Fail Test',
        email: 'fail@example.com',
        message: 'This should fail',
        metadata: {
          timestamp: new Date().toISOString(),
        },
        requestId: 'req-fail',
        transaction: {
          contactEmail: { success: true },
          autoReply: { success: true },
          errors: [],
        },
      };

      await expect(service.saveContactSubmission(submissionData)).rejects.toThrow(
        'Firestore write failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save contact submission to Firestore',
        expect.objectContaining({
          error,
          requestId: 'req-fail',
        })
      );
    });
  });
});
