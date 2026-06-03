process.env.JWT_SECRET = "test-secret-key";

const requireAuth = require("../src/middleware/authMiddleware");
const jwt = require("../src/utils/jwt");
const jsonwebtoken = require("jsonwebtoken");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("requireAuth middleware", () => {
  it("calls next() and sets req.userId when a valid token is provided", () => {
    const token = jwt.signAccess({ id: 123 });
    const req = { cookies: { token } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe(123);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 when no token cookie is present", () => {
    const req = { cookies: {} };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Not authenticated" });
  });

  it("returns 401 with code TOKEN_EXPIRED for an expired token", () => {
    const expiredToken = jsonwebtoken.sign(
      { id: 5 },
      process.env.JWT_SECRET,
      { expiresIn: -1 }
    );
    const req = { cookies: { token: expiredToken } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Token expired",
      code: "TOKEN_EXPIRED",
    });
  });

  it("returns 401 for a malformed/tampered token", () => {
    const req = { cookies: { token: "not.a.valid.jwt" } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
  });
});
