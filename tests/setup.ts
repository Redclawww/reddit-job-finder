import "jest";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";
process.env.POLL_INTERVAL_MS = "1000";
process.env.MAX_POST_AGE_HOURS = "48";

const consoleMock = {
  log: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

global.console = { ...console, ...consoleMock };
