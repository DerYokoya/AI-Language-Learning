process.env.JWT_SECRET = "test-secret-key";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.OPENROUTER_API_KEY = "test-key";

const fakeDb = require("./helpers/fakeDb");
jest.mock("../../src/db/connection", () => require("./helpers/fakeDb"));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../server");

beforeEach(() => fakeDb.reset());

describe("requireAuth wiring across protected routers", () => {
  const protectedRequests = [
    { method: "get", path: "/api/users/me" },
    { method: "get", path: "/api/chats" },
    { method: "get", path: "/api/flashcards" },
    { method: "get", path: "/api/storage/some-key" },
  ];

  it.each(protectedRequests)("rejects %s $path with 401 when no cookie is present", async ({ method, path }) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
  });

  it("rejects a tampered/invalid token with 401", async () => {
    const res = await request(app).get("/api/chats").set("Cookie", "token=not-a-real-jwt");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid token" });
  });

  it("rejects an expired token with a 401 the client can recognize as expired", async () => {
    const expired = jwt.sign({ id: 1 }, "test-secret-key", { expiresIn: -1 });
    const res = await request(app).get("/api/chats").set("Cookie", `token=${expired}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token expired" });
  });
});

describe("per-user data isolation", () => {
  async function signup(email) {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/signup").send({ email, password: "password123" });
    return { agent, userId: res.body.id };
  }

  it("keeps one user's chats invisible and unreachable to another user", async () => {
    const { agent: alice } = await signup("alice@example.com");
    const { agent: bob } = await signup("bob@example.com");

    const created = await alice.post("/api/chats").send({
      title: "Alice's chat",
      mode: "conversation",
      language: "Spanish",
      difficulty: "Beginner",
    });
    const chatId = created.body.id;

    // Bob doesn't see Alice's chat in his list.
    const bobList = await bob.get("/api/chats");
    expect(bobList.body).toEqual([]);

    // Bob can't fetch it directly either — the controller scopes by user_id,
    // so the row simply isn't found for him.
    const bobGet = await bob.get(`/api/chats/${chatId}`);
    expect(bobGet.body.id).toBeUndefined();

    // Bob's delete for Alice's chat id is a no-op; Alice still has her chat.
    await bob.delete(`/api/chats/${chatId}`);
    const aliceList = await alice.get("/api/chats");
    expect(aliceList.body).toHaveLength(1);
    expect(aliceList.body[0].id).toBe(chatId);
  });

  it("keeps one user's key/value storage separate from another's", async () => {
    const { agent: alice } = await signup("alice2@example.com");
    const { agent: bob } = await signup("bob2@example.com");

    await alice.put("/api/storage/theme").send({ value: "dark" });

    const bobRead = await bob.get("/api/storage/theme");
    expect(bobRead.body).toEqual({ value: null });

    const aliceRead = await alice.get("/api/storage/theme");
    expect(aliceRead.body).toEqual({ value: "dark" });
  });
});
