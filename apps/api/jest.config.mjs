export default {
  testEnvironment: 'node',
  // Real PostgreSQL migration and application startup can exceed Jest's 5s default.
  testTimeout: 30000,
  testMatch: ['<rootDir>/test/**/*.test.mjs'],
  transform: {},
};
