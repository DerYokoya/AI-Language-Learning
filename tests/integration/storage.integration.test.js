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

describe("user storage", () => {
  it("returns null for a key that was never set", async () => {
    const agent = await loggedInAgent();
    const res = await agent.get("/api/storage/theme");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ value: null });
  });

  it("sets a key, reads it back, then overwrites it (upsert)", async () => {
    const agent = await loggedInAgent();

    await agent.put("/api/storage/theme").send({ value: "dark" });
    let res = await agent.get("/api/storage/theme");
    expect(res.body).toEqual({ value: "dark" });

    await agent.put("/api/storage/theme").send({ value: "light" });
    res = await agent.get("/api/storage/theme");
    expect(res.body).toEqual({ value: "light" });
  });

  it("deletes a key", async () => {
    const agent = await loggedInAgent();
    await agent.put("/api/storage/streak").send({ value: "5" });

    const del = await agent.delete("/api/storage/streak");
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ success: true });

    const res = await agent.get("/api/storage/streak");
    expect(res.body).toEqual({ value: null });
  });

  it("bulk-fetches multiple keys at once, skipping ones that don't exist", async () => {
    const agent = await loggedInAgent();
    await agent.put("/api/storage/theme").send({ value: "dark" });
    await agent.put("/api/storage/streak").send({ value: "5" });

    const res = await agent.post("/api/storage/bulk").send({ keys: ["theme", "streak", "missing"] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ theme: "dark", streak: "5" });
  });

  it("returns an empty object for bulk fetch with no keys", async () => {
    const agent = await loggedInAgent();
    const res = await agent.post("/api/storage/bulk").send({ keys: [] });
    expect(res.body).toEqual({});
  });

  it("requires authentication for every storage route", async () => {
    const res = await request(app).get("/api/storage/theme");
    expect(res.status).toBe(401);
  });
});
