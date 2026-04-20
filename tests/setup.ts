// Test setup file
import 'jest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.POLL_INTERVAL_MS = '1000';

// Mock console to avoid noise in tests
const consoleMock = {
  log: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

global.console = { ...console, ...consoleMock };
