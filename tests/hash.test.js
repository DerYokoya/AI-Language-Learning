const hash = require("../src/utils/hash");

describe("hash utility", () => {
  describe("hashPassword", () => {
    it("returns a non-empty string different from the original password", async () => {
      const result = await hash.hashPassword("mypassword");
      expect(typeof result).toBe("string");
      expect(result).not.toBe("mypassword");
      expect(result.length).toBeGreaterThan(0);
    });

    it("produces different hashes for the same password (salt randomness)", async () => {
      const h1 = await hash.hashPassword("same");
      const h2 = await hash.hashPassword("same");
      expect(h1).not.toBe(h2);
    });
  });

  describe("comparePassword", () => {
    it("returns true when password matches the hash", async () => {
      const hashed = await hash.hashPassword("correct-horse");
      const result = await hash.comparePassword("correct-horse", hashed);
      expect(result).toBe(true);
    });

    it("returns false when password does not match", async () => {
      const hashed = await hash.hashPassword("correct-horse");
      const result = await hash.comparePassword("wrong-password", hashed);
      expect(result).toBe(false);
    });

    it("returns false for an empty string against a real hash", async () => {
      const hashed = await hash.hashPassword("secret");
      const result = await hash.comparePassword("", hashed);
      expect(result).toBe(false);
    });
  });
});
