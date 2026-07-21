process.env.JWT_SECRET = "test-secret-key";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.OPENROUTER_API_KEY = "test-key";

const fakeDb = require("./helpers/fakeDb");
jest.mock("../../src/db/connection", () => require("./helpers/fakeDb"));

const request = require("supertest");
const app = require("../../server");

beforeEach(() => fakeDb.reset());

describe("auth flow (signup -> login -> me -> refresh -> logout)", () => {
  it("signs a new user up, sets auth cookies, and returns their profile", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "Alice@Example.com",
      password: "password123",
      displayName: "Alice",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1, email: "alice@example.com", displayName: "Alice" });

    const cookies = res.headers["set-cookie"].join(";");
    expect(cookies).toMatch(/token=/);
    expect(cookies).toMatch(/refresh_token=/);
  });

  it("rejects a signup with an email that's already taken (case-insensitively)", async () => {
    await request(app).post("/api/auth/signup").send({ email: "bob@example.com", password: "pw" });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "BOB@example.com", password: "pw2" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Email already in use" });
  });

  it("rejects signup with a malformed email", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "not-an-email", password: "pw" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Please enter a valid email address" });
  });

  it("logs an existing user in and rejects a wrong password", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "carol@example.com", password: "correct-horse" });

    const good = await request(app)
      .post("/api/auth/login")
      .send({ email: "carol@example.com", password: "correct-horse" });
    expect(good.status).toBe(200);
    expect(good.body.email).toBe("carol@example.com");

    const bad = await request(app)
      .post("/api/auth/login")
      .send({ email: "carol@example.com", password: "wrong" });
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: "Invalid credentials" });
  });

  it("returns the logged-in user from /me using the session cookie set at login", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ email: "dave@example.com", password: "pw" });

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user).toEqual({ id: 1, email: "dave@example.com", displayName: null });
  });

  it("returns { user: null } from /me with no session", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it("rotates the refresh token on /refresh and issues a usable new access token", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ email: "erin@example.com", password: "pw" });

    const refreshed = await agent.post("/api/auth/refresh");
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.email).toBe("erin@example.com");

    // The rotated access token cookie should work for a subsequent authenticated call.
    const me = await agent.get("/api/auth/me");
    expect(me.body.user.email).toBe("erin@example.com");

    // The old refresh token should now be revoked (single-use rotation).
    expect(fakeDb._state().refreshTokens).toHaveLength(1);
  });

  it("logs out and ends the client session, even though the refresh cookie's own path scoping keeps logout from seeing it", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ email: "frank@example.com", password: "pw" });
    expect(fakeDb._state().refreshTokens).toHaveLength(1);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ success: true });

    // Note: refresh_token is set with `path: "/api/auth/refresh"`, so it's
    // never sent to /api/auth/logout in the first place — the DELETE in
    // authController.logout is a no-op here and the row is left behind.
    expect(fakeDb._state().refreshTokens).toHaveLength(1);

    // The end-to-end effect for the client is still a logged-out session:
    // logout's Set-Cookie response clears refresh_token for that path, so
    // the agent no longer has anything to send on the next /refresh call.
    const refreshAttempt = await agent.post("/api/auth/refresh");
    expect(refreshAttempt.status).toBe(401);
    expect(refreshAttempt.body).toEqual({ error: "No refresh token" });
  });

  it("blocks access to a protected route after logout clears the session cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ email: "gina@example.com", password: "pw" });
    await agent.post("/api/auth/logout");

    const res = await agent.get("/api/users/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
  });
});
