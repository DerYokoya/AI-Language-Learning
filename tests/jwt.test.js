const jwt = require("../src/utils/jwt");

// Set required env vars before tests run
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-key";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
});

describe("jwt utility", () => {
  describe("signAccess / verify", () => {
    it("signs and verifies an access token with the user id", () => {
      const token = jwt.signAccess({ id: 42 });
      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token);
      expect(decoded.id).toBe(42);
    });

    it("throws when verifying with the wrong secret", () => {
      const token = jwt.signAccess({ id: 1 });
      // Tamper by replacing signature segment
      const [h, p] = token.split(".");
      const badToken = `${h}.${p}.badsig`;
      expect(() => jwt.verify(badToken)).toThrow();
    });

    it("throws TokenExpiredError for expired tokens", async () => {
      const jsonwebtoken = require("jsonwebtoken");
      const expiredToken = jsonwebtoken.sign(
        { id: 99 },
        process.env.JWT_SECRET,
        { expiresIn: -1 }
      );
      expect(() => jwt.verify(expiredToken)).toThrow(
        expect.objectContaining({ name: "TokenExpiredError" })
      );
    });
  });

  describe("signRefresh / verifyRefresh", () => {
    it("signs and verifies a refresh token with the user id", () => {
      const token = jwt.signRefresh({ id: 7 });
      expect(typeof token).toBe("string");

      const decoded = jwt.verifyRefresh(token);
      expect(decoded.id).toBe(7);
    });

    it("rejects an access token passed to verifyRefresh", () => {
      const accessToken = jwt.signAccess({ id: 5 });
      // Access token is signed with JWT_SECRET; refresh verifier uses JWT_REFRESH_SECRET
      expect(() => jwt.verifyRefresh(accessToken)).toThrow();
    });

    it("falls back to JWT_SECRET + _refresh when JWT_REFRESH_SECRET is unset", () => {
      const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      const token = jwt.signRefresh({ id: 3 });
      const decoded = jwt.verifyRefresh(token);
      expect(decoded.id).toBe(3);

      process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
    });
  });
});
