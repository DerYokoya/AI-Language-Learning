process.env.JWT_SECRET = "test-secret-key";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.OPENROUTER_API_KEY = "test-key";

const fakeDb = require("./helpers/fakeDb");
jest.mock("../../src/db/connection", () => require("./helpers/fakeDb"));

const fakeOpenrouter = require("./helpers/fakeOpenrouter");
jest.mock("../../src/services/openrouter", () => require("./helpers/fakeOpenrouter"));

const request = require("supertest");
const app = require("../../server");

// This file gets its own module registry (Jest isolates that per test file),
// so the rate limiter's in-memory store here starts fresh and isn't shared
// with other integration test files.

const askBody = { prompt: "Hi", targetLanguage: "Spanish", difficulty: "Beginner" };

describe("AI endpoint rate limiting", () => {
  it("limits guests to 10 requests/min and then returns 429", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post("/api/ai/ask").send(askBody);
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).post("/api/ai/ask").send(askBody);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "Too many requests, please slow down." });
  }, 15000);

  it("gives a logged-in user a higher budget (30/min) than a guest, tracked independently", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ email: "poweruser@example.com", password: "password123" });

    // A logged-in user can make more requests than the guest limit of 10
    // without being throttled, because they're keyed separately by user id.
    for (let i = 0; i < 15; i++) {
      const res = await agent.post("/api/ai/ask").send(askBody);
      expect(res.status).toBe(200);
    }
  }, 15000);
});
