export default {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/unit/!(__skip__)/**/*.test.js',
    '**/tests/services/**/*.realcoverage.test.js',
    '**/tests/integration/**/*.test.js' // Re-add integration tests
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/services/experimental/**/*.js',
    '!src/index.js',
    '!src/config/**/*.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    'src/services/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
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
  setupFilesAfterEnv: ['./tests/setup.js'],
  // Note: setupFilesAfterEnv is not used with ESM to avoid 'jest is not defined' errors
  // Each test file should handle its own setup if needed
};
