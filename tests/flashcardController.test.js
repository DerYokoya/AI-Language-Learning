const mockQuery = jest.fn();
jest.mock("../src/db/connection", () => ({ query: mockQuery }));

const flashcardController = require("../src/controllers/flashcardController");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => mockQuery.mockReset());

const CARD = { id: 1, user_id: 10, language: "Spanish", difficulty: "beginner", front: "hola", back: "hello", known: false, review_count: 0 };

describe("flashcardController.list", () => {
  it("returns all flashcards for the user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CARD] });

    const req = { userId: 10 };
    const res = mockRes();

    await flashcardController.list(req, res);

    expect(res.json).toHaveBeenCalledWith([CARD]);
  });
});

describe("flashcardController.bulkAdd", () => {
  it("inserts each card and returns success", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const cards = [
      { language: "Spanish", difficulty: "beginner", front: "hola", back: "hello" },
      { language: "Spanish", difficulty: "beginner", front: "adiós", back: "goodbye" },
    ];

    const req = { userId: 10, body: cards };
    const res = mockRes();

    await flashcardController.bulkAdd(req, res);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("succeeds with an empty array (no DB calls)", async () => {
    const req = { userId: 10, body: [] };
    const res = mockRes();

    await flashcardController.bulkAdd(req, res);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});

describe("flashcardController.update", () => {
  it("marks a card as known and increments review_count", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = { userId: 10, params: { id: "1" }, body: { known: true } };
    const res = mockRes();

    await flashcardController.update(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("review_count=review_count+1"),
      [true, "1", 10]
    );
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});

describe("flashcardController.clear", () => {
  it("deletes all flashcards for the user and returns success", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = { userId: 10 };
    const res = mockRes();

    await flashcardController.clear(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      "DELETE FROM flashcards WHERE user_id=$1",
      [10]
    );
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
