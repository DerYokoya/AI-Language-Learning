module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/db/connection.js",
    "!src/services/openrouter.js",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  clearMocks: true,
};
