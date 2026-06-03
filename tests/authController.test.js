process.env.JWT_SECRET = "test-secret-key";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

// ── Mock the DB ────────────────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock("../src/db/connection", () => ({ query: mockQuery }));

const authController = require("../src/controllers/authController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const bcrypt = require("bcrypt");

async function fakeUser(overrides = {}) {
  return {
    id: 1,
    email: "alice@example.com",
    password_hash: await bcrypt.hash("password123", 10),
    display_name: "Alice",
    ...overrides,
  };
}

beforeEach(() => mockQuery.mockReset());

// ── signup ─────────────────────────────────────────────────────────────────────
describe("authController.signup", () => {
  it("creates a user and returns their info", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })           // no existing user
      .mockResolvedValueOnce({ rows: [{ id: 1, email: "alice@example.com", display_name: "Alice" }] }) // INSERT user
      .mockResolvedValueOnce({ rows: [] });           // INSERT refresh token

    const req = { body: { email: "alice@example.com", password: "password123", displayName: "Alice" } };
    const res = mockRes();

    await authController.signup(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alice@example.com", displayName: "Alice" })
    );
    expect(res.cookie).toHaveBeenCalledWith("token", expect.any(String), expect.any(Object));
  });

  it("returns 400 when email is missing", async () => {
    const req = { body: { password: "password123" } };
    const res = mockRes();

    await authController.signup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Email and password are required" });
  });

  it("returns 400 when email is already in use", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 99 }] }); // existing user found

    const req = { body: { email: "taken@example.com", password: "pass" } };
    const res = mockRes();

    await authController.signup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Email already in use" });
  });
});

// ── login ──────────────────────────────────────────────────────────────────────
describe("authController.login", () => {
  it("returns user info and sets cookies on valid credentials", async () => {
    const user = await fakeUser();
    mockQuery
      .mockResolvedValueOnce({ rows: [user] })  // SELECT user
      .mockResolvedValueOnce({ rows: [] });     // INSERT refresh token

    const req = { body: { email: user.email, password: "password123" } };
    const res = mockRes();

    await authController.login(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email })
    );
    expect(res.cookie).toHaveBeenCalledWith("token", expect.any(String), expect.any(Object));
  });

  it("returns 400 for an unknown email", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = { body: { email: "nobody@example.com", password: "x" } };
    const res = mockRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid credentials" });
  });

  it("returns 400 for a wrong password", async () => {
    const user = await fakeUser();
    mockQuery.mockResolvedValueOnce({ rows: [user] });

    const req = { body: { email: user.email, password: "wrongpassword" } };
    const res = mockRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid credentials" });
  });

  it("returns 400 when password field is missing", async () => {
    const req = { body: { email: "alice@example.com" } };
    const res = mockRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── logout ─────────────────────────────────────────────────────────────────────
describe("authController.logout", () => {
  it("deletes the refresh token and clears cookies", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // DELETE

    const req = { cookies: { refresh_token: "sometoken" } };
    const res = mockRes();

    await authController.logout(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      "DELETE FROM refresh_tokens WHERE token=$1",
      ["sometoken"]
    );
    expect(res.clearCookie).toHaveBeenCalledWith("token");
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("succeeds even when there is no refresh_token cookie", async () => {
    const req = { cookies: {} };
    const res = mockRes();

    await authController.logout(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});

// ── refresh ────────────────────────────────────────────────────────────────────
describe("authController.refresh", () => {
  it("returns 401 when no refresh_token cookie is present", async () => {
    const req = { cookies: {} };
    const res = mockRes();

    await authController.refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "No refresh token" });
  });

  it("returns 401 for a malformed refresh token", async () => {
    const req = { cookies: { refresh_token: "garbage" } };
    const res = mockRes();

    await authController.refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid refresh token" });
  });

  it("returns 401 when the token has been revoked (not in DB)", async () => {
    const jwt = require("../src/utils/jwt");
    const token = jwt.signRefresh({ id: 1 });

    mockQuery.mockResolvedValueOnce({ rows: [] }); // no row found

    const req = { cookies: { refresh_token: token } };
    const res = mockRes();

    await authController.refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Refresh token revoked or expired" });
  });

  it("rotates the refresh token and returns fresh user info", async () => {
    const jwt = require("../src/utils/jwt");
    const token = jwt.signRefresh({ id: 1 });

    mockQuery
      .mockResolvedValueOnce({ rows: [{ token }] })  // SELECT: token found
      .mockResolvedValueOnce({ rows: [] })            // DELETE old token
      .mockResolvedValueOnce({ rows: [] })            // INSERT new refresh token
      .mockResolvedValueOnce({ rows: [{ id: 1, email: "alice@example.com", display_name: "Alice" }] }); // SELECT user

    const req = { cookies: { refresh_token: token } };
    const res = mockRes();

    await authController.refresh(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alice@example.com" })
    );
    expect(res.cookie).toHaveBeenCalledWith("token", expect.any(String), expect.any(Object));
  });
});

// ── me ─────────────────────────────────────────────────────────────────────────
describe("authController.me", () => {
  it("returns { user: null } when no token cookie is present", async () => {
    const req = { cookies: {} };
    const res = mockRes();

    await authController.me(req, res);

    expect(res.json).toHaveBeenCalledWith({ user: null });
  });

  it("returns { user: null } for an invalid token", async () => {
    const req = { cookies: { token: "bad.token.here" } };
    const res = mockRes();

    await authController.me(req, res);

    expect(res.json).toHaveBeenCalledWith({ user: null });
  });

  it("returns the user object for a valid token", async () => {
    const jwt = require("../src/utils/jwt");
    const token = jwt.signAccess({ id: 1 });

    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: "alice@example.com", display_name: "Alice" }] });

    const req = { cookies: { token } };
    const res = mockRes();

    await authController.me(req, res);

    expect(res.json).toHaveBeenCalledWith({
      user: { id: 1, email: "alice@example.com", displayName: "Alice" },
    });
  });

  it("returns { user: null } when user is not found in the DB", async () => {
    const jwt = require("../src/utils/jwt");
    const token = jwt.signAccess({ id: 999 });

    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = { cookies: { token } };
    const res = mockRes();

    await authController.me(req, res);

    expect(res.json).toHaveBeenCalledWith({ user: null });
  });
});
