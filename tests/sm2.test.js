// sm2.js is a native ES module (loaded via <script type="module"> in the
// browser, no build step). Rather than pull in Babel just to let Jest's
// CommonJS test runner understand `import`/`export`, we load it with a
// dynamic import() — Node's CJS runtime supports that natively, so a single
// beforeAll is all it takes.

let sm2;

beforeAll(async () => {
  sm2 = await import("../public/js/sm2.js");
});

describe("sm2.newSchedule", () => {
  it("returns a card due immediately with default ease/interval/reps", () => {
    const schedule = sm2.newSchedule();
    expect(schedule.easeFactor).toBe(2.5);
    expect(schedule.interval).toBe(0);
    expect(schedule.repetitions).toBe(0);
    expect(new Date(schedule.nextReview).getTime()).not.toBeNaN();
  });
});

describe("sm2.grade", () => {
  it("resets repetitions and interval to 1 day on a failing grade (Again)", () => {
    const schedule = { easeFactor: 2.5, interval: 10, repetitions: 4 };
    const next = sm2.grade(schedule, sm2.GRADES.AGAIN);
    expect(next.repetitions).toBe(0);
    expect(next.interval).toBe(1);
  });

  it("follows the 1 -> 6 -> ease*interval progression on successful grades", () => {
    let schedule = sm2.newSchedule();

    schedule = sm2.grade(schedule, sm2.GRADES.GOOD);
    expect(schedule.repetitions).toBe(1);
    expect(schedule.interval).toBe(1);

    schedule = sm2.grade(schedule, sm2.GRADES.GOOD);
    expect(schedule.repetitions).toBe(2);
    expect(schedule.interval).toBe(6);

    const easeBeforeThirdReview = schedule.easeFactor;
    schedule = sm2.grade(schedule, sm2.GRADES.GOOD);
    expect(schedule.repetitions).toBe(3);
    expect(schedule.interval).toBe(Math.round(6 * easeBeforeThirdReview));
  });

  it("never lets the ease factor drop below the 1.3 floor", () => {
    let schedule = { easeFactor: 1.3, interval: 1, repetitions: 3 };
    for (let i = 0; i < 10; i++) {
      schedule = sm2.grade(schedule, sm2.GRADES.AGAIN);
    }
    expect(schedule.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("does not mutate the schedule passed in", () => {
    const schedule = { easeFactor: 2.5, interval: 6, repetitions: 2 };
    const snapshot = { ...schedule };
    sm2.grade(schedule, sm2.GRADES.GOOD);
    expect(schedule).toEqual(snapshot);
  });
});

describe("sm2.isDue", () => {
  it("treats a card with no nextReview as due", () => {
    expect(sm2.isDue({})).toBe(true);
  });

  it("is due once the nextReview date has passed", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(sm2.isDue({ nextReview: past })).toBe(true);
  });

  it("is not due before the nextReview date", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    expect(sm2.isDue({ nextReview: future })).toBe(false);
  });
});

describe("sm2.isLearned", () => {
  it("is false for a fresh card", () => {
    expect(sm2.isLearned({})).toBe(false);
  });

  it("is true once repetitions >= 2 and interval >= 21", () => {
    expect(sm2.isLearned({ repetitions: 2, interval: 21 })).toBe(true);
  });

  it("is false if only one of the two thresholds is met", () => {
    expect(sm2.isLearned({ repetitions: 2, interval: 20 })).toBe(false);
    expect(sm2.isLearned({ repetitions: 1, interval: 30 })).toBe(false);
  });
});
