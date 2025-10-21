module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/functions/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'mjs'],
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverageFrom: [
    'functions/src/**/*.ts',
    '!functions/src/**/*.d.ts',
    '!functions/src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  passWithNoTests: true,
  // Clear mocks automatically between every test
  clearMocks: true,
  // Reset modules registry for each test file
  resetModules: true,
  // Handle dynamic imports properly with updated config format
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'ESNext',
      },
    }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
