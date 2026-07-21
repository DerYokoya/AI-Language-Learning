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

describe("chats CRUD lifecycle", () => {
  it("creates, lists, fetches with messages, updates, and deletes a chat", async () => {
    const agent = await loggedInAgent();

    const create = await agent.post("/api/chats").send({
      title: "Restaurant practice",
      mode: "conversation",
      language: "Spanish",
      difficulty: "Beginner",
      scenario: "restaurant",
      autoReadEnabled: true,
    });
    expect(create.status).toBe(200);
    expect(create.body).toMatchObject({ title: "Restaurant practice", language: "Spanish" });
    const chatId = create.body.id;

    const list = await agent.get("/api/chats");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(chatId);

    await agent.post(`/api/chats/${chatId}/messages`).send({
      sender: "user",
      text: "Hola, una mesa para dos por favor",
      html: "<p>Hola, una mesa para dos por favor</p>",
    });
    await agent.post(`/api/chats/${chatId}/messages`).send({
      sender: "assistant",
      text: "¡Claro! Síganme por favor.",
      html: "<p>¡Claro! Síganme por favor.</p>",
    });

    const fetched = await agent.get(`/api/chats/${chatId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.id).toBe(chatId);
    expect(fetched.body.messages).toHaveLength(2);
    expect(fetched.body.messages[0].sender).toBe("user");
    expect(fetched.body.messages[1].sender).toBe("assistant");

    const update = await agent.put(`/api/chats/${chatId}`).send({
      title: "Restaurant practice (updated)",
      mode: "conversation",
      language: "Spanish",
      difficulty: "Intermediate",
      scenario: "restaurant",
      autoReadEnabled: false,
    });
    expect(update.status).toBe(200);
    expect(update.body).toEqual({ success: true });

    const afterUpdate = await agent.get(`/api/chats/${chatId}`);
    expect(afterUpdate.body.title).toBe("Restaurant practice (updated)");
    expect(afterUpdate.body.difficulty).toBe("Intermediate");

    const del = await agent.delete(`/api/chats/${chatId}`);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ success: true });

    const listAfterDelete = await agent.get("/api/chats");
    expect(listAfterDelete.body).toEqual([]);

    // Deleting the chat should cascade its messages too.
    expect(fakeDb._state().chatMessages).toHaveLength(0);
  });

  it("bumps the chat's updated_at when a message is added, affecting list order", async () => {
    const agent = await loggedInAgent();

    const first = await agent.post("/api/chats").send({ title: "First", mode: "conversation", language: "Spanish", difficulty: "Beginner" });
    await new Promise(r => setTimeout(r, 5));
    const second = await agent.post("/api/chats").send({ title: "Second", mode: "conversation", language: "French", difficulty: "Beginner" });

    // Freshly created, "Second" should sort first (most recently updated).
    let list = await agent.get("/api/chats");
    expect(list.body.map(c => c.title)).toEqual(["Second", "First"]);

    // Touch "First" by adding a message to it — it should now sort first.
    await new Promise(r => setTimeout(r, 5));
    await agent.post(`/api/chats/${first.body.id}/messages`).send({ sender: "user", text: "hi" });

    list = await agent.get("/api/chats");
    expect(list.body.map(c => c.title)).toEqual(["First", "Second"]);
  });
});
