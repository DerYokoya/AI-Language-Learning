module.exports = {
  testEnvironment: "node",
  maxWorkers: 1,
  setupFilesAfterEnv: ["<rootDir>/tests/setupEnv.js"],
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    
    
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  clearMocks: true,
};