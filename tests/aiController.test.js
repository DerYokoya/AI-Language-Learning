// Mock the OpenRouter client before requiring the controller
const mockCreate = jest.fn();
jest.mock("../src/services/openrouter", () => ({
  chat: {
    completions: {
      create: mockCreate,
    },
  },
}));

const aiController = require("../src/controllers/aiController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => mockCreate.mockReset());

describe("aiController.ask", () => {
  it("returns the AI reply on a successful request", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "¡Hola! ¿Cómo estás?" } }],
    });

    const req = { body: { prompt: "Hello", targetLanguage: "Spanish", difficulty: "beginner" } };
    const res = mockRes();

    await aiController.ask(req, res);

    expect(res.json).toHaveBeenCalledWith({ reply: "¡Hola! ¿Cómo estás?" });
  });

  it("passes the target language and difficulty into the prompt", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Bonjour" } }],
    });

    const req = { body: { prompt: "Hi", targetLanguage: "French", difficulty: "advanced" } };
    const res = mockRes();

    await aiController.ask(req, res);

    const callArg = mockCreate.mock.calls[0][0];
    const userMessage = callArg.messages.find((m) => m.role === "user");
    expect(userMessage.content).toContain("French");
    expect(userMessage.content).toContain("advanced");
  });

  it("returns 500 when the AI client throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API down"));

    const req = { body: { prompt: "Hi", targetLanguage: "Spanish", difficulty: "beginner" } };
    const res = mockRes();

    await aiController.ask(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "AI request failed" });
  });
});
