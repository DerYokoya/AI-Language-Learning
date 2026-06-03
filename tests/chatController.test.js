const mockQuery = jest.fn();
jest.mock("../src/db/connection", () => ({ query: mockQuery }));

const chatController = require("../src/controllers/chatController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => mockQuery.mockReset());

const CHAT = { id: 1, user_id: 10, title: "Spanish Chat", mode: "conversation", language: "Spanish", difficulty: "beginner" };

describe("chatController.listChats", () => {
  it("returns all chats for the authenticated user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CHAT] });

    const req = { userId: 10 };
    const res = mockRes();

    await chatController.listChats(req, res);

    expect(res.json).toHaveBeenCalledWith([CHAT]);
  });
});

describe("chatController.getChat", () => {
  it("returns the chat with its messages", async () => {
    const msgs = [{ id: 1, chat_id: 1, sender: "user", text: "Hola" }];
    mockQuery
      .mockResolvedValueOnce({ rows: [CHAT] })   // SELECT chat
      .mockResolvedValueOnce({ rows: msgs });     // SELECT messages

    const req = { userId: 10, params: { id: "1" } };
    const res = mockRes();

    await chatController.getChat(req, res);

    expect(res.json).toHaveBeenCalledWith({ ...CHAT, messages: msgs });
  });
});

describe("chatController.createChat", () => {
  it("inserts a new chat and returns it", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CHAT] });

    const req = {
      userId: 10,
      body: { title: "Spanish Chat", mode: "conversation", language: "Spanish", difficulty: "beginner", scenario: null, autoReadEnabled: false },
    };
    const res = mockRes();

    await chatController.createChat(req, res);

    expect(res.json).toHaveBeenCalledWith(CHAT);
  });
});

describe("chatController.updateChat", () => {
  it("updates the chat and returns success", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = {
      userId: 10,
      params: { id: "1" },
      body: { title: "Updated", mode: "grammar", language: "French", difficulty: "advanced", scenario: null, autoReadEnabled: true },
    };
    const res = mockRes();

    await chatController.updateChat(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});

describe("chatController.deleteChat", () => {
  it("deletes the chat and its messages, returns success", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })  // DELETE messages
      .mockResolvedValueOnce({ rows: [] }); // DELETE chat

    const req = { userId: 10, params: { id: "1" } };
    const res = mockRes();

    await chatController.deleteChat(req, res);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});

describe("chatController.addMessage", () => {
  it("inserts a message and updates the chat timestamp", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })  // INSERT message
      .mockResolvedValueOnce({ rows: [] }); // UPDATE chat

    const req = {
      params: { id: "1" },
      body: { sender: "user", text: "Hola", html: "<p>Hola</p>" },
    };
    const res = mockRes();

    await chatController.addMessage(req, res);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
