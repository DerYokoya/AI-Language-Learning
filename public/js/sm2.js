/**
 * sm2.js — SuperMemo-2 spaced repetition algorithm.
 *
 * Deliberately kept as a pure module with no DOM/storage access: every
 * function here takes plain data in and returns plain data out, so the
 * scheduling logic can be read (and tested) in complete isolation from the
 * flashcard UI in flashcards.js.
 *
 * Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 *
 * Grading scale used by the UI (a common 4-button simplification of
 * SuperMemo's original 0-5 scale — see GRADES below):
 *   Again (0) — got it wrong, forgot completely
 *   Hard  (3) — got it right, but it took real effort
 *   Good  (4) — got it right after a short pause
 *   Easy  (5) — got it right instantly
 */

export const GRADES = {
  AGAIN: 0,
  HARD: 3,
  GOOD: 4,
  EASY: 5,
};

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

/** The SM-2 fields a brand new card should start with, due immediately. */
export function newSchedule() {
  return {
    easeFactor: DEFAULT_EASE_FACTOR,
    interval: 0, // days
    repetitions: 0,
    nextReview: new Date().toISOString(),
  };
}

/**
 * Given a card's current schedule and a quality grade (0-5), returns the
 * *next* schedule per the SM-2 algorithm. Does not mutate its input.
 *
 * Core rules:
 *  - quality < 3 ("Again") resets the learning streak: repetitions -> 0,
 *    interval -> 1 day. A forgotten card is treated as brand new.
 *  - quality >= 3 grows the interval: 1 day -> 6 days -> interval * easeFactor,
 *    and the ease factor itself is nudged up or down based on how easy the
 *    recall felt, floored at 1.3 so a hard card never spirals to near-zero
 *    intervals.
 */
export function grade(schedule, quality) {
  const prev = { ...newSchedule(), ...schedule };
  let { easeFactor, repetitions } = prev;
  let interval;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(prev.interval * easeFactor);
    repetitions += 1;
  }

  easeFactor =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(easeFactor, MIN_EASE_FACTOR);

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    easeFactor: Math.round(easeFactor * 100) / 100,
    interval,
    repetitions,
    nextReview: nextReview.toISOString(),
  };
}

/** True once a card's nextReview date has arrived (or it has none yet). */
export function isDue(card, now = new Date()) {
  if (!card.nextReview) return true;
  return new Date(card.nextReview) <= now;
}

/**
 * A card is "learned" once it has survived at least two successful reviews
 * and its interval has stretched past three weeks — SM-2 doesn't define this
 * label itself, it's just a UI-friendly threshold for the "Mastered" tab.
 */
export function isLearned(card) {
  return (card.repetitions || 0) >= 2 && (card.interval || 0) >= 21;
}
