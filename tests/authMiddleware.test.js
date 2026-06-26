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
    expect(next).toHaveBeenCalledWith(); // called with no args = success
    expect(req.userId).toBe(123);
  });

  it("calls next(err) with 401 when no token cookie is present", () => {
    const req = { cookies: {} };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Not authenticated");
  });

  it("calls next(err) with 401 TOKEN_EXPIRED for an expired token", () => {
    const expiredToken = jsonwebtoken.sign(
      { id: 5 },
      process.env.JWT_SECRET,
      { expiresIn: -1 }
    );
    const req = { cookies: { token: expiredToken } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Token expired");
  });

  it("calls next(err) with 401 for a malformed/tampered token", () => {
    const req = { cookies: { token: "not.a.valid.jwt" } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Invalid token");
  });
});
