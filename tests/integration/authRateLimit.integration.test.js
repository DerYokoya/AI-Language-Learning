process.env.JWT_SECRET = "test-secret-key";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.OPENROUTER_API_KEY = "test-key";

const fakeDb = require("./helpers/fakeDb");
jest.mock("../../src/db/connection", () => require("./helpers/fakeDb"));

const request = require("supertest");
const app = require("../../server");

// Isolated in its own file so the authLimiter's in-memory store (shared by
// every /api/auth/* route) starts fresh and isn't polluted by other
// integration test files making their own signup/login calls.

describe("auth brute-force rate limiting", () => {
  it("allows 20 attempts within the window, then returns 429 on the 21st", async () => {
    for (let i = 0; i < 20; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "wrong" });
      // Each of these is a legitimate 400 (bad credentials) — the limiter
      // shouldn't kick in yet.
      expect(res.status).toBe(400);
    }

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong" });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "Too many attempts, please try again later." });
  }, 20000);
});
