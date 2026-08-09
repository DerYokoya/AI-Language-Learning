import { appStorage } from './appStorage.js';
import { addMessage, stripMarkdown } from './chat.js';
import { conversationHistory } from './main.js';
import * as sm2 from './sm2.js';

let currentFlashcardOverlay = null;

// Storage helpers
export async function loadSavedCards() {
  try {
    const raw = await appStorage.getItem("fc_cards");
    const cards = raw ? JSON.parse(raw) : [];
    // Backfill SM-2 fields for cards saved before spaced repetition existed,
    // so old decks keep working without a manual migration step.
    return cards.map((c) =>
      c.nextReview ? c : { ...sm2.newSchedule(), ...c }
    );
  } catch (e) {
    return [];
  }
}

async function saveCards(cards) {
  await appStorage.setItem("fc_cards", JSON.stringify(cards));
}

/**
 * Grade a card after review using the SM-2 algorithm (see sm2.js).
 * `quality` is one of sm2.GRADES (Again/Hard/Good/Easy). This replaces the
 * old binary known/unknown flag with a real spaced-repetition schedule:
 * every grade updates the card's ease factor, interval, and next-due date.
 */
export async function markCard(id, quality) {
  const cards = await loadSavedCards();
  const card = cards.find((c) => c.id === id);
  if (!card) return null;

  const nextSchedule = sm2.grade(card, quality);
  Object.assign(card, nextSchedule);
  card.reviewCount = (card.reviewCount || 0) + 1;
  // Kept for backward compatibility with anything still reading `known`
  // (e.g. older saved UI state); derived from the new schedule, not set directly.
  card.known = sm2.isLearned(card);
  await saveCards(cards);
  return card;
}

export function getStats(cards) {
  const total = cards.length;
  const known = cards.filter((c) => sm2.isLearned(c)).length;
  const due = cards.filter((c) => sm2.isDue(c)).length;
  const unknown = total - known;
  return { total, known, unknown, due };
}

async function mergeNewCards(newCards, language, difficulty) {
  const existing = await loadSavedCards();
  let added = 0;

  newCards.forEach((nc) => {
    const dupe = existing.find(
      (ec) => ec.front.toLowerCase().trim() === nc.front.toLowerCase().trim() && ec.language === language
    );
    if (!dupe) {
      existing.push({
        id: Date.now() + Math.random(),
        front: nc.front,
        back: nc.back,
        language,
        difficulty,
        known: false,
        addedAt: new Date().toISOString(),
        reviewCount: 0,
        ...sm2.newSchedule(), // easeFactor, interval, repetitions, nextReview — due now
      });
      added++;
    }
  });

  await saveCards(existing);
  return { all: existing, added };
}

function parseFlashcards(text) {
  const blocks = text.split("CARD:").slice(1);
  return blocks.map((block) => {
    const front = block.match(/Front:\s*([^\n]+)/)?.[1]?.trim();
    const backMatch = block.match(/Back:\s*([\s\S]*?)(?=CARD:|$)/);
    const back = backMatch ? backMatch[1].trim() : "";
    return { front, back };
  });
}

async function generateFlashcards() {
  const targetLanguage = document.getElementById("language-select").value;
  const difficulty = document.getElementById("difficulty-select").value;

  const historyText = conversationHistory
    .map((m) => `${m.sender}: ${m.text}`)
    .join("\n");

  const chatWindow = document.getElementById("chat-window");
  
  // Show typing indicator
  const typing = document.createElement("div");
  typing.classList.add("typing");
  typing.id = "typing-indicator";
  typing.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  chatWindow.appendChild(typing);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  const response = await fetch("/api/ai/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `Generate exactly 6 flashcards to help me practice ${targetLanguage} at ${difficulty} level.
Use vocabulary or phrases from our recent conversation if available, otherwise choose useful common words.
Output ONLY a raw JSON array — no markdown, no code fences, no extra text.
Each item must have exactly two keys:
  "front": a word or phrase in ${targetLanguage}
  "back": the English translation, then two newlines, then a short usage example in ${targetLanguage}

Conversation so far:
${historyText || "(no conversation yet)"}`,
      targetLanguage,
      difficulty,
      mode: "flashcard",
    }),
  });

  // Remove typing indicator
  const typingElem = document.getElementById("typing-indicator");
  if (typingElem) typingElem.remove();

  if (response.status === 429) {
    addMessage("⏱️ Too many requests! Please wait a moment before generating flashcards.", "system-error");
    return;
  }

  const data = await response.json();

  // Try JSON parsing first (more reliable), fall back to legacy CARD: parser
  let newCards;
  try {
    const raw = (data.reply || "").trim()
      .replace(/^```[a-z]*(?:\r?\n)?/i, "").replace(/```$/, "").trim();
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("no array");
    newCards = JSON.parse(raw.slice(start, end + 1))
      .filter((c) => c.front && c.back);
  } catch {
    newCards = parseFlashcards(data.reply);
  }
  const { all: allCards, added } = await mergeNewCards(newCards, targetLanguage, difficulty);

  const langCards = allCards
    .filter((c) => c.language === targetLanguage)
    .sort((a, b) => {
      const aDue = sm2.isDue(a), bDue = sm2.isDue(b);
      if (aDue !== bDue) return aDue ? -1 : 1; // due cards first
      return new Date(a.nextReview) - new Date(b.nextReview); // soonest due next
    });

  startFlashcardMode(langCards, added);
}

function startFlashcardMode(cards, newlyAdded = 0) {
  if (currentFlashcardOverlay) {
    currentFlashcardOverlay.remove();
  }

  cards = cards.filter((c) => c.front && c.back);

  if (!cards.length) {
    addMessage("⚠️ Couldn't generate flashcards. Try again after a short conversation.", "system-error");
    return;
  }

  let currentIndex = 0;
  let flipped = false;
  let activeView = "all";
  let viewCards = [...cards];
  let autoSkip = false;
  const dark = document.body.classList.contains("dark");

  // Theme-aware colors
  const t = {
    bg: dark ? "#2a2a2a" : "#fff",
    text: dark ? "#f1f1f1" : "#111",
    subtext: dark ? "#aaa" : "#888",
    hint: dark ? "#777" : "#aaa",
    cardBg: dark ? "#3a3a3a" : "#f5f7ff",
    cardBorder: dark ? "#4a5080" : "#d0d8ff",
    cardFlipped: dark ? "#1b3b1f" : "#e8f5e9",
    progressBg: dark ? "#444" : "#eee",
    btnBg: dark ? "#3a3a3a" : "#fff",
    btnBorder: dark ? "#555" : "#ccc",
    btnText: dark ? "#ddd" : "#333",
    tabInactBg: dark ? "#3a3a3a" : "#fff",
    tabInactTxt: dark ? "#bbb" : "#555",
    tabInactBdr: dark ? "#555" : "#ccc",
  };

  const overlay = document.createElement("div");
  overlay.id = "flashcard-overlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.75);
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; z-index: 9999; font-family: inherit;
  `;

  overlay.innerHTML = `
    <div id="fc-container" style="
      background: ${t.bg}; color: ${t.text}; border-radius: 20px;
      padding: 28px 36px; max-width: 520px; width: 92%; text-align: center;
      box-shadow: 0 12px 48px rgba(0,0,0,0.45);
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div id="fc-counter" style="font-size:13px; color:${t.subtext};"></div>
        <div id="fc-stats" style="font-size:13px; color:${t.subtext};"></div>
      </div>

      ${newlyAdded > 0 ? `<div id="fc-new-badge" style="font-size:12px; color:#7b8ef8; margin-bottom:8px; font-weight:600;">+${newlyAdded} new card${newlyAdded > 1 ? 's' : ''} added to your deck!</div>` : ""}

      <div style="background:${t.progressBg}; border-radius:999px; height:6px; margin-bottom:16px; overflow:hidden;">
        <div id="fc-progress-bar" style="height:100%; background: linear-gradient(90deg, #5b6af0, #8b9cf8); border-radius:999px; transition: width 0.3s;"></div>
      </div>

      <div id="fc-card" style="
        border-radius: 14px; padding: 36px 24px;
        min-height: 130px; display:flex; align-items:center; justify-content:center;
        font-size: 1.5rem; cursor: pointer; transition: background 0.25s, border-color 0.25s;
        user-select: none; border: 2px solid ${t.cardBorder}; background: ${t.cardBg};
        white-space: pre-wrap; flex-direction: column; gap: 8px;
      ">
        <span id="fc-text" style="font-size:1.5rem; color:${t.text};"></span>
        <span id="fc-known-badge" style="font-size:12px; display:none; padding:2px 10px; border-radius:999px; background:#4caf50; color:#fff; font-weight:600;">✓ Learned</span>
      </div>
      <p id="fc-hint" style="font-size:13px; color:${t.hint}; margin-top:10px; min-height:18px;"></p>

      <div style="display:flex; gap:10px; margin-top:16px; justify-content:center; flex-wrap: wrap;">
        <button id="fc-prev" style="padding:10px 18px; border-radius:9px; border:1px solid ${t.btnBorder}; cursor:pointer; font-size:14px; background:${t.btnBg}; color:${t.btnText};">← Prev</button>
        <button id="fc-flip" style="padding:10px 18px; border-radius:9px; background:#5b6af0; color:#fff; border:none; cursor:pointer; font-size:14px;">Flip</button>
        <button id="fc-next" style="padding:10px 18px; border-radius:9px; border:1px solid ${t.btnBorder}; cursor:pointer; font-size:14px; background:${t.btnBg}; color:${t.btnText};">Next →</button>
      </div>

      <div style="display:flex; gap:8px; margin-top:14px; justify-content:center; flex-wrap:wrap; align-items:center;">
        <button id="fc-grade-again" data-quality="0" style="padding:10px 16px; border-radius:10px; border:2px solid #ef5350; background:${t.btnBg}; color:#ef5350; cursor:pointer; font-size:13px; font-weight:600;">✗ Again</button>
        <button id="fc-grade-hard" data-quality="3" style="padding:10px 16px; border-radius:10px; border:2px solid #ffa726; background:${t.btnBg}; color:#ffa726; cursor:pointer; font-size:13px; font-weight:600;">😓 Hard</button>
        <button id="fc-grade-good" data-quality="4" style="padding:10px 16px; border-radius:10px; border:2px solid #42a5f5; background:${t.btnBg}; color:#42a5f5; cursor:pointer; font-size:13px; font-weight:600;">🙂 Good</button>
        <button id="fc-grade-easy" data-quality="5" style="padding:10px 16px; border-radius:10px; border:2px solid #4caf50; background:${t.btnBg}; color:#4caf50; cursor:pointer; font-size:13px; font-weight:600;">✓ Easy</button>
      </div>
      <p id="fc-next-review" style="font-size:12px; color:${t.hint}; margin-top:6px; min-height:16px;"></p>

      <div style="margin-top:10px; text-align:center;">
        <button id="fc-autoskip-toggle" style="padding:5px 16px; border-radius:999px; border:1px solid ${t.btnBorder}; background:${t.btnBg}; color:${t.hint}; cursor:pointer; font-size:12px;">⏭ Auto-skip: OFF</button>
      </div>

      <div style="display:flex; gap:8px; margin-top:16px; justify-content:center; font-size:13px; flex-wrap:wrap;">
        <button id="fc-tab-all" class="fc-tab" style="padding:5px 14px; border-radius:999px; border:1px solid #5b6af0; background:#5b6af0; color:#fff; cursor:pointer; font-size:12px;">All</button>
        <button id="fc-tab-due" class="fc-tab" style="padding:5px 14px; border-radius:999px; border:1px solid ${t.tabInactBdr}; background:${t.tabInactBg}; color:${t.tabInactTxt}; cursor:pointer; font-size:12px;">⏰ Due</button>
        <button id="fc-tab-known" class="fc-tab" style="padding:5px 14px; border-radius:999px; border:1px solid ${t.tabInactBdr}; background:${t.tabInactBg}; color:${t.tabInactTxt}; cursor:pointer; font-size:12px;">✓ Mastered</button>
        <button id="fc-clear-deck" style="padding:5px 14px; border-radius:999px; border:1px solid #f44336; background:${t.btnBg}; color:#f44336; cursor:pointer; font-size:12px;">🗑 Clear Deck</button>
      </div>

      <button id="fc-close" style="margin-top:18px; background:none; border:none; color:${t.hint}; font-size:13px; cursor:pointer; text-decoration:underline;">Close flashcards</button>
    </div>
  `;

  document.body.appendChild(overlay);
  currentFlashcardOverlay = overlay;

  async function getViewCards() {
    const all = (await loadSavedCards()).filter(
      (c) => c.language === document.getElementById("language-select").value
    );
    if (activeView === "due")
      return all
        .filter((c) => sm2.isDue(c))
        .sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview));
    if (activeView === "known") return all.filter((c) => sm2.isLearned(c));
    return all;
  }

  async function refreshViewCards() {
    viewCards = await getViewCards();
    if (currentIndex >= viewCards.length) currentIndex = Math.max(0, viewCards.length - 1);
    if (viewCards.length === 0) {
      document.getElementById("fc-text").textContent =
        activeView === "known"
          ? "No mastered cards yet. Keep studying!"
          : activeView === "due"
          ? "🎉 Nothing due right now — come back later!"
          : "No cards yet. Generate some with the Flashcards button!";
      document.getElementById("fc-hint").textContent = "";
      document.getElementById("fc-known-badge").style.display = "none";
      document.getElementById("fc-progress-bar").style.width = "0%";
      await updateStats();
    } else {
      render();
    }
  }

  async function updateStats() {
    const allLang = (await loadSavedCards()).filter((c) => c.language === document.getElementById("language-select").value);
    const s = getStats(allLang);
    document.getElementById("fc-stats").textContent = `✓ ${s.known} / ${s.total} · ⏰ ${s.due} due`;
    const pct = s.total > 0 ? (s.known / s.total) * 100 : 0;
    document.getElementById("fc-progress-bar").style.width = pct + "%";
  }

  async function render() {
    if (!viewCards.length) { await refreshViewCards(); return; }
    const card = viewCards[currentIndex];
    const learned = sm2.isLearned(card);
    flipped = false;
    document.getElementById("fc-text").textContent = card.front;
    document.getElementById("fc-card").style.background = t.cardBg;
    document.getElementById("fc-card").style.borderColor = learned ? "#4caf50" : t.cardBorder;
    document.getElementById("fc-hint").textContent = "Click the card to flip • Space or Enter to flip";
    document.getElementById("fc-counter").textContent = `Card ${currentIndex + 1} of ${viewCards.length}`;
    document.getElementById("fc-next-review").textContent = sm2.isDue(card)
      ? "Due now"
      : `Next review: ${new Date(card.nextReview).toLocaleDateString()}`;
    const badge = document.getElementById("fc-known-badge");
    badge.style.display = learned ? "inline-block" : "none";
    await updateStats();
  }

  function doFlip() {
    if (!viewCards.length) return;
    const card = viewCards[currentIndex];
    flipped = !flipped;
    document.getElementById("fc-text").textContent = flipped ? card.back : card.front;
    document.getElementById("fc-card").style.background = flipped ? t.cardFlipped : t.cardBg;
    document.getElementById("fc-hint").textContent = flipped ? "Back side" : "Click the card to flip • Space or Enter to flip";
  }

  async function goToNextCard() {
    if (viewCards.length === 0) return;
    if (currentIndex + 1 < viewCards.length) {
      currentIndex++;
      await render();
    } else {
      if (activeView === "due" && viewCards.length > 0) {
        const remainingDue = viewCards.filter((c) => sm2.isDue(c)).length;
        if (remainingDue === 0) {
          addMessage("🎉 Congratulations! You've cleared your review queue!", "system-success");
        }
      }
      currentIndex = 0;
      await render();
    }
  }

  /**
   * Grade the current card via SM-2 (quality: sm2.GRADES.AGAIN/HARD/GOOD/EASY)
   * and refresh the UI to reflect its new schedule. Replaces the old binary
   * doKnown/doUnknown handlers now that every review updates a real
   * ease-factor/interval/next-review schedule instead of a single flag.
   */
  async function doGrade(quality) {
    if (!viewCards.length) return;
    const card = viewCards[currentIndex];
    const updated = await markCard(card.id, quality);
    if (updated) Object.assign(card, updated);
    const learned = sm2.isLearned(card);
    document.getElementById("fc-card").style.borderColor = learned ? "#4caf50" : t.cardBorder;
    document.getElementById("fc-known-badge").style.display = learned ? "inline-block" : "none";
    document.getElementById("fc-next-review").textContent = `Next review: ${new Date(card.nextReview).toLocaleDateString()}`;
    await updateStats();
    if (autoSkip) {
      setTimeout(async () => {
        // In the Due queue, a just-graded card may drop out of view entirely
        // (its next review is now in the future), so re-fetch before deciding
        // whether to advance the index or just re-render in place.
        const oldLen = viewCards.length;
        await refreshViewCards();
        if (activeView !== "due" || oldLen === viewCards.length) {
          await goToNextCard();
        }
      }, 300);
    }
  }

  async function setTab(tab) {
    activeView = tab;
    currentIndex = 0;
    ["all", "due", "known"].forEach((tabId) => {
      const btn = document.getElementById(`fc-tab-${tabId}`);
      if (!btn) return;
      if (tabId === tab) {
        btn.style.background = "#5b6af0";
        btn.style.color = "#fff";
        btn.style.borderColor = "#5b6af0";
      } else {
        btn.style.background = t.tabInactBg;
        btn.style.color = t.tabInactTxt;
        btn.style.borderColor = t.tabInactBdr;
      }
    });
    await refreshViewCards();
  }

  render();

  // Event listeners
  document.getElementById("fc-card").addEventListener("click", doFlip);
  document.getElementById("fc-flip").addEventListener("click", doFlip);
  ["again", "hard", "good", "easy"].forEach((name) => {
    const btn = document.getElementById(`fc-grade-${name}`);
    btn.addEventListener("click", () => doGrade(Number(btn.dataset.quality)));
  });
  document.getElementById("fc-prev").addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + viewCards.length) % Math.max(1, viewCards.length);
    render();
  });
  document.getElementById("fc-next").addEventListener("click", () => {
    goToNextCard();
  });
  document.getElementById("fc-tab-all").addEventListener("click", () => setTab("all"));
  document.getElementById("fc-tab-due").addEventListener("click", () => setTab("due"));
  document.getElementById("fc-tab-known").addEventListener("click", () => setTab("known"));
  document.getElementById("fc-autoskip-toggle").addEventListener("click", () => {
    autoSkip = !autoSkip;
    const btn = document.getElementById("fc-autoskip-toggle");
    if (autoSkip) {
      btn.textContent = "⏭ Auto-skip: ON";
      btn.style.background = "#5b6af0";
      btn.style.color = "#fff";
      btn.style.borderColor = "#5b6af0";
    } else {
      btn.textContent = "⏭ Auto-skip: OFF";
      btn.style.background = t.btnBg;
      btn.style.color = t.hint;
      btn.style.borderColor = t.btnBorder;
    }
  });
  document.getElementById("fc-clear-deck").addEventListener("click", async () => {
    const lang = document.getElementById("language-select").value;
    if (confirm(`Clear ALL saved ${lang} flashcards? This cannot be undone.`)) {
      const remaining = (await loadSavedCards()).filter((c) => c.language !== lang);
      await saveCards(remaining);
      currentIndex = 0;
      await refreshViewCards();
    }
  });
  document.getElementById("fc-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const gradeColors = { again: "#ef5350", hard: "#ffa726", good: "#42a5f5", easy: "#4caf50" };
  Object.entries(gradeColors).forEach(([name, color]) => {
    const btn = document.getElementById(`fc-grade-${name}`);
    btn.addEventListener("mouseenter", () => { btn.style.background = color; btn.style.color = "#fff"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = t.btnBg; btn.style.color = color; });
  });

  function onKey(e) {
    if (!document.getElementById("flashcard-overlay")) {
      document.removeEventListener("keydown", onKey);
      return;
    }
    if (e.key === "ArrowRight") {
      goToNextCard();
    } else if (e.key === "ArrowLeft") {
      currentIndex = (currentIndex - 1 + viewCards.length) % Math.max(1, viewCards.length);
      render();
    } else if (e.key === " " || e.key === "Enter") {
      doFlip();
      e.preventDefault();
    } else if (e.key === "1") {
      doGrade(sm2.GRADES.AGAIN);
    } else if (e.key === "2") {
      doGrade(sm2.GRADES.HARD);
    } else if (e.key === "3") {
      doGrade(sm2.GRADES.GOOD);
    } else if (e.key === "4") {
      doGrade(sm2.GRADES.EASY);
    } else if (e.key === "Escape") {
      overlay.remove();
    }
  }
  document.addEventListener("keydown", onKey);
}

export function initFlashcards() {
  const flashcardBtn = document.getElementById("flashcard-btn");
  flashcardBtn.addEventListener("click", () => {
    document.getElementById("activities-menu")?.classList.remove("open");
    generateFlashcards();
  });
}