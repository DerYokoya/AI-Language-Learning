process.env.JWT_SECRET = "test-secret-key";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.OPENROUTER_API_KEY = "test-key";

const fakeDb = require("./helpers/fakeDb");
jest.mock("../../src/db/connection", () => require("./helpers/fakeDb"));

const fakeOpenrouter = require("./helpers/fakeOpenrouter");
jest.mock("../../src/services/openrouter", () => require("./helpers/fakeOpenrouter"));

const request = require("supertest");
const app = require("../../server");

beforeEach(() => {
  fakeDb.reset();
  fakeOpenrouter.chat.completions.create.mockClear();
});

describe("POST /api/ai/ask", () => {
  it("returns a tutor reply for the default conversation mode", async () => {
    fakeOpenrouter.__setReply("¡Hola! ¿Cómo estás?");

    const res = await request(app).post("/api/ai/ask").send({
      prompt: "Hello",
      targetLanguage: "Spanish",
      difficulty: "Beginner",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "¡Hola! ¿Cómo estás?" });

    const callArg = fakeOpenrouter.chat.completions.create.mock.calls[0][0];
    const userMessage = callArg.messages.find(m => m.role === "user");
    expect(userMessage.content).toContain("Spanish");
    expect(userMessage.content).toContain("Beginner");
  });

  it("returns raw JSON for cloze mode using a strict system prompt", async () => {
    fakeOpenrouter.__setReply('[{"sentence":"Yo ___ estudiante","options":["soy","es","son"],"answer":"soy","hint":"ser"}]');

    const res = await request(app).post("/api/ai/ask").send({
      prompt: "Give me a cloze exercise",
      targetLanguage: "Spanish",
      difficulty: "Beginner",
      mode: "cloze",
    });

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body.reply)).toHaveLength(1);

    const callArg = fakeOpenrouter.chat.completions.create.mock.calls[0][0];
    expect(callArg.messages[0].role).toBe("system");
    expect(callArg.messages[0].content).toContain("raw JSON array");
  });

  it("returns raw JSON for flashcard mode", async () => {
    fakeOpenrouter.__setReply('[{"front":"hola","back":"hello\\n\\nHola, ¿qué tal?"}]');

    const res = await request(app).post("/api/ai/ask").send({
      prompt: "Give me flashcards",
      targetLanguage: "Spanish",
      difficulty: "Beginner",
      mode: "flashcard",
    });

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body.reply)).toEqual([{ front: "hola", back: "hello\n\nHola, ¿qué tal?" }]);
  });

  it("returns a single bare sentence for listening mode", async () => {
    fakeOpenrouter.__setReply("El gato duerme en el sofá");

    const res = await request(app).post("/api/ai/ask").send({
      prompt: "Give me a sentence",
      targetLanguage: "Spanish",
      difficulty: "Beginner",
      mode: "listening",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "El gato duerme en el sofá" });
  });

  it("maps an upstream 429 to a friendly 429 AppError", async () => {
    fakeOpenrouter.__failNext(429);

    const res = await request(app).post("/api/ai/ask").send({
      prompt: "Hi",
      targetLanguage: "Spanish",
      difficulty: "Beginner",
    });

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: "Rate limit reached. Please wait a moment before trying again." });
  });

  it("maps a generic upstream failure to a 503", async () => {
    fakeOpenrouter.__failNext();

    const res = await request(app).post("/api/ai/ask").send({
      prompt: "Hi",
      targetLanguage: "Spanish",
      difficulty: "Beginner",
    });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "AI request failed" });
  });

  it("works for anonymous (logged-out) requests since /api/ai isn't behind requireAuth", async () => {
    fakeOpenrouter.__setReply("Bonjour!");
    const res = await request(app).post("/api/ai/ask").send({
      prompt: "Hi",
      targetLanguage: "French",
      difficulty: "Beginner",
    });
    expect(res.status).toBe(200);
  });
});
