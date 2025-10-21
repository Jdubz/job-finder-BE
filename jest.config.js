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
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 8,
      lines: 7,
      statements: 7,
    },
  },
  passWithNoTests: true,
  // Clear mocks automatically between every test
  clearMocks: true,
  // Reset modules registry for each test file
  resetModules: true,
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/functions/src/__tests__/setup.ts'],
  // Handle dynamic imports properly with updated config format
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      isolatedModules: true,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'node',
      },
    }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
