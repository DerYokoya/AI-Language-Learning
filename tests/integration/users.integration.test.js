process.env.JWT_SECRET = "test-secret-key";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.OPENROUTER_API_KEY = "test-key";

const fakeDb = require("./helpers/fakeDb");
jest.mock("../../src/db/connection", () => require("./helpers/fakeDb"));

const request = require("supertest");
const app = require("../../server");

beforeEach(() => fakeDb.reset());

async function loggedInAgent(email = "learner@example.com") {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({ email, password: "password123" });
  return agent;
}

describe("users routes", () => {
  it("returns the authenticated user's email from /me", async () => {
    const agent = await loggedInAgent("learner@example.com");
    const res = await agent.get("/api/users/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: "learner@example.com" });
  });

  it("creates settings on first save and updates them on a later save (upsert)", async () => {
    const agent = await loggedInAgent();

    const first = await agent.put("/api/users/settings").send({
      theme: "dark",
      language: "French",
      difficulty: "Beginner",
      autoReadEnabled: true,
    });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ success: true });
    expect(fakeDb._state().userSettings).toHaveLength(1);

    await agent.put("/api/users/settings").send({
      theme: "light",
      language: "German",
      difficulty: "Advanced",
      autoReadEnabled: false,
    });

    // Still exactly one settings row for this user — it was updated, not duplicated.
    const rows = fakeDb._state().userSettings;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ theme: "light", language: "German", difficulty: "Advanced", auto_read_enabled: false });
  });

  it("requires authentication for user routes", async () => {
    const res = await request(app).put("/api/users/settings").send({ theme: "dark" });
    expect(res.status).toBe(401);
  });
});
