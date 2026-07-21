process.env.JWT_SECRET = "test-secret-key";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.OPENROUTER_API_KEY = "test-key";

const fakeDb = require("./helpers/fakeDb");
jest.mock("../../src/db/connection", () => require("./helpers/fakeDb"));

const request = require("supertest");
const app = require("../../server");

beforeEach(() => fakeDb.reset());

describe("cross-cutting error handling", () => {
  it("returns Express's default 404 for an unknown route", async () => {
    const res = await request(app).get("/api/not-a-real-route");
    expect(res.status).toBe(404);
  });

  it("hides internal error details behind a generic 500 for unexpected (non-operational) errors", async () => {
    // Malformed JSON is rejected by express.json() with a SyntaxError before
    // it ever reaches a controller — a good check that the error handler at
    // the end of the middleware chain catches errors it didn't originate.
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not valid json");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("returns a consistent { error } shape for operational AppErrors raised deep in a controller", async () => {
    const res = await request(app).post("/api/auth/signup").send({ password: "onlypassword" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Email and password are required" });
  });

  it("serves the SPA shell for the /index route", async () => {
    const res = await request(app).get("/index");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });

  // Note: express.static("public") is mounted before the custom "/index.html"
  // redirect handler, and public/index.html exists — so static file serving
  // wins and the redirect route is effectively unreachable for GET requests.
  // This test documents that actual, current behavior rather than the
  // apparently-intended redirect.
  it("serves the static index.html directly for /index.html (the redirect route is shadowed by express.static)", async () => {
    const res = await request(app).get("/index.html");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });
});
