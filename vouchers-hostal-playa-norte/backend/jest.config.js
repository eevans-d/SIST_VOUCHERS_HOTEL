export default {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  moduleNameMapper: {
    // Handle .js extensions in relative imports
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Handle @ alias imports (if configured elsewhere)
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  resolver: undefined, // Use default resolution with native ESM support
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js',
    '!src/server.js'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/'
  ],
  transform: {},
  testTimeout: 10000,
  // Note: setupFilesAfterEnv is not used with ESM to avoid 'jest is not defined' errors
  // Each test file should handle its own setup if needed
};
