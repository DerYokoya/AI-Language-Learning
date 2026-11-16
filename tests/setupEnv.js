/**
 * Runs before every test file (jest setupFilesAfterEnv).
 *
 * - Loads TEST_DATABASE_URL from .env.test so you don't have to export it in
 *   every shell. A variable already set in the environment (e.g. CI) wins.
 * - Integration tests that need a database fail immediately with a clear
 *   message instead of "getaddrinfo ENOTFOUND base" (which is what you get
 *   when `process.env.DATABASE_URL = undefined` turns into the string
 *   "undefined").
 * - Refuses to run if TEST_DATABASE_URL is the same database as your dev
 *   DATABASE_URL, because the tests TRUNCATE every table between tests.
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const root = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.test"), quiet: true });

const testPath = expect.getState().testPath || "";
const isIntegration = testPath.includes(`${path.sep}integration${path.sep}`);

if (isIntegration) {
  const testUrl = process.env.TEST_DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Create a separate test database, load " +
        "src/db/schema.sql into it, and put its URL in .env.test (see " +
        ".env.test.example) or export it in your shell."
    );
  }

  const envFile = path.join(root, ".env");
  const devUrl =
    process.env.DATABASE_URL_DEV ||
    (fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)).DATABASE_URL : undefined);

  if (devUrl && devUrl === testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is identical to DATABASE_URL in .env. The tests " +
        "wipe all tables, so use a separate database for testing."
    );
  }
}