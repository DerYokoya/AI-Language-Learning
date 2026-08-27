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
  res.setHeader = jest.fn();
  res.flushHeaders = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  return res;
}

function mockNext() {
  return jest.fn();
}

beforeEach(() => mockCreate.mockReset());

describe("aiController.ask", () => {
  it("returns the AI reply on a successful request", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "¡Hola! ¿Cómo estás?" } }],
    });

    const req = { body: { prompt: "Hello", targetLanguage: "Spanish", difficulty: "beginner" } };
    const res = mockRes();
    const next = mockNext();

    await aiController.ask(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ reply: "¡Hola! ¿Cómo estás?" });
    expect(next).not.toHaveBeenCalled();
  });

  it("passes the target language and difficulty into the prompt", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Bonjour" } }],
    });

    const req = { body: { prompt: "Hi", targetLanguage: "French", difficulty: "advanced" } };
    const res = mockRes();
    const next = mockNext();

    await aiController.ask(req, res, next);

    const callArg = mockCreate.mock.calls[0][0];
    const userMessage = callArg.messages.find((m) => m.role === "user");
    expect(userMessage.content).toContain("French");
    expect(userMessage.content).toContain("advanced");
  });

  it("forwards the error to next() when the AI client throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API down"));

    const req = { body: { prompt: "Hi", targetLanguage: "Spanish", difficulty: "beginner" } };
    const res = mockRes();
    const next = mockNext();

    await aiController.ask(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("aiController.stream", () => {
  it("streams content deltas as SSE events", async () => {
    mockCreate.mockResolvedValueOnce((async function* () {
      yield { choices: [{ delta: { content: "¡Hola! " } }] };
      yield { choices: [{ delta: { content: "¿Cómo estás?" } }] };
    })());

    const req = { body: { prompt: "Hello", targetLanguage: "Spanish", difficulty: "beginner" } };
    const res = mockRes();
    const next = mockNext();

    await aiController.stream(req, res, next);

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ stream: true }));
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream; charset=utf-8");
    expect(res.write).toHaveBeenNthCalledWith(1, 'data: "¡Hola! "\n\n');
    expect(res.write).toHaveBeenNthCalledWith(2, 'data: "¿Cómo estás?"\n\n');
    expect(res.write).toHaveBeenNthCalledWith(3, "data: [DONE]\n\n");
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});