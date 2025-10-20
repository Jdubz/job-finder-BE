/**
 * Test Environment Setup
 * 
 * This file runs before each test suite and sets up the testing environment.
 * It configures Firebase emulators, mocks, and global test utilities.
 */

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FUNCTIONS_EMULATOR = 'true';

// Increase timeout for tests that may take longer
jest.setTimeout(30000);
