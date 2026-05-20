'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/**/__tests__/**/*.test.js'],
  // Load .env.test before any test suite runs so DATABASE_URL etc. are set
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Silence console.warn during test runs (safety-check warnings are expected)
  silent: true,
};
