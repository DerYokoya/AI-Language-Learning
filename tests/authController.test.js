process.env.JWT_SECRET = "test-secret-key";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

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

function mockNext() {
  return jest.fn();
}

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
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 1, email: "alice@example.com", display_name: "Alice" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const req = {
      body: {
        email: "alice@example.com",
        password: "password123",
        displayName: "Alice",
      },
    };
    const res = mockRes();
    const next = mockNext();

    await authController.signup(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "alice@example.com",
        displayName: "Alice",
      }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "token",
      expect.any(String),
      expect.any(Object),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next with 400 AppError when email is missing", async () => {
    const req = { body: { password: "password123" } };
    const res = mockRes();
    const next = mockNext();

    await authController.signup(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: "Email and password are required",
      }),
    );
    expect(res.json).not.toHaveBeenCalled();
  });

  it("calls next with 400 AppError when email is already in use", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 99 }] });

    const req = { body: { email: "taken@example.com", password: "pass" } };
    const res = mockRes();
    const next = mockNext();

    await authController.signup(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: "Email already in use",
      }),
    );
    expect(res.json).not.toHaveBeenCalled();
  });
});

// ── login ──────────────────────────────────────────────────────────────────────
describe("authController.login", () => {
  it("returns user info and sets cookies on valid credentials", async () => {
    const user = await fakeUser();
    mockQuery
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValueOnce({ rows: [] });

    const req = { body: { email: user.email, password: "password123" } };
    const res = mockRes();
    const next = mockNext();

    await authController.login(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "token",
      expect.any(String),
      expect.any(Object),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next with 400 AppError for an unknown email", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = { body: { email: "nobody@example.com", password: "x" } };
    const res = mockRes();
    const next = mockNext();

    await authController.login(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: "Invalid credentials",
      }),
    );
  });

  it("calls next with 400 AppError for a wrong password", async () => {
    const user = await fakeUser();
    mockQuery.mockResolvedValueOnce({ rows: [user] });

    const req = { body: { email: user.email, password: "wrongpassword" } };
    const res = mockRes();
    const next = mockNext();

    await authController.login(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: "Invalid credentials",
      }),
    );
  });

  it("calls next with 400 AppError when password field is missing", async () => {
    const req = { body: { email: "alice@example.com" } };
    const res = mockRes();
    const next = mockNext();

    await authController.login(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});

// ── logout ─────────────────────────────────────────────────────────────────────
describe("authController.logout", () => {
  it("deletes the refresh token and clears cookies", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = { cookies: { refresh_token: "sometoken" } };
    const res = mockRes();

    await authController.logout(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      "DELETE FROM refresh_tokens WHERE token=$1",
      ["sometoken"],
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
  it("calls next with 401 AppError when no refresh_token cookie is present", async () => {
    const req = { cookies: {} };
    const res = mockRes();
    const next = mockNext();

    await authController.refresh(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, message: "No refresh token" }),
    );
  });

  it("calls next with 401 AppError for a malformed refresh token", async () => {
    const req = { cookies: { refresh_token: "garbage" } };
    const res = mockRes();
    const next = mockNext();

    await authController.refresh(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Invalid refresh token",
      }),
    );
  });

  it("calls next with 401 AppError when the token has been revoked", async () => {
    const jwt = require("../src/utils/jwt");
    const token = jwt.signRefresh({ id: 1 });

    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = { cookies: { refresh_token: token } };
    const res = mockRes();
    const next = mockNext();

    await authController.refresh(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Refresh token revoked or expired",
      }),
    );
  });

  it("rotates the refresh token and returns fresh user info", async () => {
    const jwt = require("../src/utils/jwt");
    const token = jwt.signRefresh({ id: 1 });

    mockQuery
      .mockResolvedValueOnce({ rows: [{ token }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 1, email: "alice@example.com", display_name: "Alice" }],
      });

    const req = { cookies: { refresh_token: token } };
    const res = mockRes();
    const next = mockNext();

    await authController.refresh(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alice@example.com" }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "token",
      expect.any(String),
      expect.any(Object),
    );
    expect(next).not.toHaveBeenCalled();
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

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: "alice@example.com", display_name: "Alice" }],
    });

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
