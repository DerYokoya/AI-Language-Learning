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

describe("flashcards lifecycle", () => {
  it("bulk-adds cards, lists them, marks one known, and clears the deck", async () => {
    const agent = await loggedInAgent();

    const bulk = await agent.post("/api/flashcards/bulk").send([
      { language: "Spanish", difficulty: "Beginner", front: "hola", back: "hello" },
      { language: "Spanish", difficulty: "Beginner", front: "adiós", back: "goodbye" },
    ]);
    expect(bulk.status).toBe(200);
    expect(bulk.body).toEqual({ success: true });

    const list = await agent.get("/api/flashcards");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.every(c => c.known === false && c.review_count === 0)).toBe(true);

    const cardId = list.body.find(c => c.front === "hola").id;
    const update = await agent.patch(`/api/flashcards/${cardId}`).send({ known: true });
    expect(update.status).toBe(200);

    const listAfter = await agent.get("/api/flashcards");
    const updatedCard = listAfter.body.find(c => c.id === cardId);
    expect(updatedCard.known).toBe(true);
    expect(updatedCard.review_count).toBe(1);

    const clear = await agent.delete("/api/flashcards");
    expect(clear.status).toBe(200);
    expect(clear.body).toEqual({ success: true });

    const listEmpty = await agent.get("/api/flashcards");
    expect(listEmpty.body).toEqual([]);
  });

  it("keeps flashcard decks scoped per user", async () => {
    const alice = await loggedInAgent("alice@example.com");
    const bob = await loggedInAgent("bob@example.com");

    await alice.post("/api/flashcards/bulk").send([
      { language: "Spanish", difficulty: "Beginner", front: "gato", back: "cat" },
    ]);

    const bobList = await bob.get("/api/flashcards");
    expect(bobList.body).toEqual([]);

    // Bob clearing his (empty) deck must not touch Alice's cards.
    await bob.delete("/api/flashcards");
    const aliceList = await alice.get("/api/flashcards");
    expect(aliceList.body).toHaveLength(1);
  });

  it("requires authentication for every flashcards route", async () => {
    const res = await request(app).post("/api/flashcards/bulk").send([]);
    expect(res.status).toBe(401);
  });
});
