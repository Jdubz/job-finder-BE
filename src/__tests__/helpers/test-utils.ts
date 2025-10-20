/**
 * Test Utilities and Mocks
 * 
 * Provides common utilities, mocks, and helpers for tests.
 */

import type { Logger } from '../../utils/logger';

/**
 * Mock logger for testing
 */
export const createMockLogger = (): Logger => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
});

/**
 * Mock Firestore document reference
 */
export const createMockDocRef = (id: string) => ({
  id,
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

/**
 * Mock Firestore collection reference
 */
export const createMockCollectionRef = () => ({
  doc: jest.fn((id?: string) => createMockDocRef(id || 'test-doc-id')),
  add: jest.fn((_data: any) => Promise.resolve(createMockDocRef('new-doc-id'))),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  get: jest.fn(),
});

/**
 * Mock Firestore instance
 */
export const createMockFirestore = () => ({
  collection: jest.fn(() => createMockCollectionRef()),
  doc: jest.fn((_path: string) => createMockDocRef('test-doc-id')),
  batch: jest.fn(),
  runTransaction: jest.fn(),
});

/**
 * Create a mock authenticated context for Cloud Functions
 */
export const createMockAuthContext = (uid: string = 'test-user-123', email: string = 'test@example.com') => ({
  auth: {
    uid,
    token: {
      email,
      email_verified: true,
    },
  },
  rawRequest: {
    headers: {},
    ip: '127.0.0.1',
  },
});

/**
 * Create a mock unauthenticated context
 */
export const createMockUnauthContext = () => ({
  auth: null,
  rawRequest: {
    headers: {},
    ip: '127.0.0.1',
  },
});

/**
 * Wait for a specified amount of time (useful for async tests)
 */
export const wait = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a random test ID
 */
export const generateTestId = (prefix: string = 'test'): string => 
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
