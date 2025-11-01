export default {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js'
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
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/services/ddosProtectionService.test.js',
    '/tests/services/connectionPool.test.js',
    '/tests/services/cdnService.test.js',
    '/tests/services/cacheService.test.js',
    '/tests/services/apiVersioningService.test.js',
    '/tests/services/apiGatewayService.test.js',
    '/tests/services/anomalyDetectionService.test.js',
    '/tests/services/tokenBlacklist.test.js',
    '/tests/services/oauth2Service.test.js',
    '/tests/services/recommendationService.test.js',
    '/tests/services/priceOptimizationService.test.js',
    '/tests/services/reportBuilderService.test.js',
    '/tests/services/graphqlService.test.js',
    '/tests/services/webhookService.test.js',
    '/tests/services/complianceService.test.js',
    '/tests/services/secrets.test.js',
    '/tests/services/paginationService.test.js',
    '/tests/services/loggingService.test.js',
    '/tests/services/eventSourcingService.test.js',
    '/tests/services/demandForecastingService.test.js',
    '/tests/database/indexes.test.js',
    '/tests/security/https.test.js',
    '/tests/security/rateLimiter.test.js',
  ],

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
