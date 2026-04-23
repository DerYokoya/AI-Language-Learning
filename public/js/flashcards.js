import { addMessage, stripMarkdown } from './chat.js';
import { conversationHistory } from './main.js';

let currentFlashcardOverlay = null;

// Storage helpers
export function loadSavedCards() {
  try {
    const raw = localStorage.getItem("fc_cards");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCards(cards) {
  localStorage.setItem("fc_cards", JSON.stringify(cards));
}

export function markCard(id, known) {
  const cards = loadSavedCards();
  const card = cards.find((c) => c.id === id);
  if (card) {
    card.known = known;
    card.reviewCount = (card.reviewCount || 0) + 1;
    saveCards(cards);
  }
}

export function getStats(cards) {
  const total = cards.length;
  const known = cards.filter((c) => c.known).length;
  const unknown = total - known;
  return { total, known, unknown };
}

function mergeNewCards(newCards, language, difficulty) {
  const existing = loadSavedCards();
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
      });
      added++;
    }
  });

  saveCards(existing);
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
      Format EXACTLY like this (no extra text before or after):

      CARD:
      Front: [word or phrase in ${targetLanguage}]
      Back: [English translation]\n\n[Short usage example in ${targetLanguage}]

      IMPORTANT: Put TWO line breaks between the translation and the example.

      CARD:
      Front: ...
      Back: ...

      Conversation so far:
      ${historyText || "(no conversation yet)"}`,
      targetLanguage,
      difficulty,
    }),
  });

  // Remove typing indicator
  const typingElem = document.getElementById("typing-indicator");
  if (typingElem) typingElem.remove();

  const data = await response.json();
  const newCards = parseFlashcards(data.reply);
  const { all: allCards, added } = mergeNewCards(newCards, targetLanguage, difficulty);

  const langCards = allCards
    .filter((c) => c.language === targetLanguage)
    .sort((a, b) => {
      if (a.known === b.known) return 0;
      return a.known ? 1 : -1;
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
        <span id="fc-known-badge" style="font-size:12px; display:none; padding:2px 10px; border-radius:999px; background:#4caf50; color:#fff; font-weight:600;">✓ Known</span>
      </div>
      <p id="fc-hint" style="font-size:13px; color:${t.hint}; margin-top:10px; min-height:18px;"></p>

      <div style="display:flex; gap:10px; margin-top:16px; justify-content:center; flex-wrap: wrap;">
        <button id="fc-prev" style="padding:10px 18px; border-radius:9px; border:1px solid ${t.btnBorder}; cursor:pointer; font-size:14px; background:${t.btnBg}; color:${t.btnText};">← Prev</button>
        <button id="fc-flip" style="padding:10px 18px; border-radius:9px; background:#5b6af0; color:#fff; border:none; cursor:pointer; font-size:14px;">Flip</button>
        <button id="fc-next" style="padding:10px 18px; border-radius:9px; border:1px solid ${t.btnBorder}; cursor:pointer; font-size:14px; background:${t.btnBg}; color:${t.btnText};">Next →</button>
      </div>

      <div style="display:flex; gap:12px; margin-top:14px; justify-content:center; flex-wrap:wrap; align-items:center;">
        <button id="fc-unknown" style="padding:11px 24px; border-radius:10px; border:2px solid #ef5350; background:${t.btnBg}; color:#ef5350; cursor:pointer; font-size:14px; font-weight:600;">✗ Don't Know</button>
        <button id="fc-known" style="padding:11px 24px; border-radius:10px; border:2px solid #4caf50; background:${t.btnBg}; color:#4caf50; cursor:pointer; font-size:14px; font-weight:600;">✓ Know It</button>
      </div>

      <div style="margin-top:10px; text-align:center;">
        <button id="fc-autoskip-toggle" style="padding:5px 16px; border-radius:999px; border:1px solid ${t.btnBorder}; background:${t.btnBg}; color:${t.hint}; cursor:pointer; font-size:12px;">⏭ Auto-skip: OFF</button>
      </div>

      <div style="display:flex; gap:8px; margin-top:16px; justify-content:center; font-size:13px; flex-wrap:wrap;">
        <button id="fc-tab-all" class="fc-tab" style="padding:5px 14px; border-radius:999px; border:1px solid #5b6af0; background:#5b6af0; color:#fff; cursor:pointer; font-size:12px;">All</button>
        <button id="fc-tab-unknown" class="fc-tab" style="padding:5px 14px; border-radius:999px; border:1px solid ${t.tabInactBdr}; background:${t.tabInactBg}; color:${t.tabInactTxt}; cursor:pointer; font-size:12px;">❓ Study</button>
        <button id="fc-tab-known" class="fc-tab" style="padding:5px 14px; border-radius:999px; border:1px solid ${t.tabInactBdr}; background:${t.tabInactBg}; color:${t.tabInactTxt}; cursor:pointer; font-size:12px;">✓ Mastered</button>
        <button id="fc-clear-deck" style="padding:5px 14px; border-radius:999px; border:1px solid #f44336; background:${t.btnBg}; color:#f44336; cursor:pointer; font-size:12px;">🗑 Clear Deck</button>
      </div>

      <button id="fc-close" style="margin-top:18px; background:none; border:none; color:${t.hint}; font-size:13px; cursor:pointer; text-decoration:underline;">Close flashcards</button>
    </div>
  `;

  document.body.appendChild(overlay);
  currentFlashcardOverlay = overlay;

  function getViewCards() {
    const all = loadSavedCards().filter(
      (c) => c.language === document.getElementById("language-select").value
    );
    if (activeView === "unknown") return all.filter((c) => !c.known);
    if (activeView === "known") return all.filter((c) => c.known);
    return all;
  }

  function refreshViewCards() {
    viewCards = getViewCards();
    if (currentIndex >= viewCards.length) currentIndex = Math.max(0, viewCards.length - 1);
    if (viewCards.length === 0) {
      document.getElementById("fc-text").textContent =
        activeView === "known"
          ? "No mastered cards yet. Keep studying!"
          : activeView === "unknown"
          ? "🎉 You've mastered all cards in this view!"
          : "No cards yet. Generate some with the Flashcards button!";
      document.getElementById("fc-hint").textContent = "";
      document.getElementById("fc-known-badge").style.display = "none";
      document.getElementById("fc-progress-bar").style.width = "0%";
      updateStats();
    } else {
      render();
    }
  }

  function updateStats() {
    const allLang = loadSavedCards().filter((c) => c.language === document.getElementById("language-select").value);
    const s = getStats(allLang);
    document.getElementById("fc-stats").textContent = `✓ ${s.known} / ${s.total}`;
    const pct = s.total > 0 ? (s.known / s.total) * 100 : 0;
    document.getElementById("fc-progress-bar").style.width = pct + "%";
  }

  function render() {
    if (!viewCards.length) { refreshViewCards(); return; }
    const card = viewCards[currentIndex];
    flipped = false;
    document.getElementById("fc-text").textContent = card.front;
    document.getElementById("fc-card").style.background = t.cardBg;
    document.getElementById("fc-card").style.borderColor = card.known ? "#4caf50" : t.cardBorder;
    document.getElementById("fc-hint").textContent = "Click the card to flip • Space or Enter to flip";
    document.getElementById("fc-counter").textContent = `Card ${currentIndex + 1} of ${viewCards.length}`;
    const badge = document.getElementById("fc-known-badge");
    badge.style.display = card.known ? "inline-block" : "none";
    updateStats();
  }

  function doFlip() {
    if (!viewCards.length) return;
    const card = viewCards[currentIndex];
    flipped = !flipped;
    document.getElementById("fc-text").textContent = flipped ? card.back : card.front;
    document.getElementById("fc-card").style.background = flipped ? t.cardFlipped : t.cardBg;
    document.getElementById("fc-hint").textContent = flipped ? "Back side" : "Click the card to flip • Space or Enter to flip";
  }

  function doKnown() {
    if (!viewCards.length) return;
    const card = viewCards[currentIndex];
    markCard(card.id, true);
    card.known = true;
    document.getElementById("fc-card").style.borderColor = "#4caf50";
    document.getElementById("fc-known-badge").style.display = "inline-block";
    updateStats();
    if (autoSkip) {
      setTimeout(() => {
        refreshViewCards();
        if (currentIndex >= viewCards.length) currentIndex = 0;
        render();
      }, 600);
    }
  }

  function doUnknown() {
    if (!viewCards.length) return;
    const card = viewCards[currentIndex];
    markCard(card.id, false);
    card.known = false;
    document.getElementById("fc-card").style.borderColor = "#ef5350";
    document.getElementById("fc-known-badge").style.display = "none";
    updateStats();
    if (autoSkip) {
      setTimeout(() => {
        refreshViewCards();
        currentIndex = (currentIndex + 1) % Math.max(1, viewCards.length);
        render();
      }, 600);
    }
  }

  function setTab(tab) {
    activeView = tab;
    currentIndex = 0;
    ["all", "unknown", "known"].forEach((tabId) => {
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
    refreshViewCards();
  }

  render();

  // Event listeners
  document.getElementById("fc-card").addEventListener("click", doFlip);
  document.getElementById("fc-flip").addEventListener("click", doFlip);
  document.getElementById("fc-known").addEventListener("click", doKnown);
  document.getElementById("fc-unknown").addEventListener("click", doUnknown);
  document.getElementById("fc-prev").addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + viewCards.length) % Math.max(1, viewCards.length);
    render();
  });
  document.getElementById("fc-next").addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % Math.max(1, viewCards.length);
    render();
  });
  document.getElementById("fc-tab-all").addEventListener("click", () => setTab("all"));
  document.getElementById("fc-tab-unknown").addEventListener("click", () => setTab("unknown"));
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
      btn.style.background = "#fff";
      btn.style.color = "#888";
      btn.style.borderColor = "#ccc";
    }
  });
  document.getElementById("fc-clear-deck").addEventListener("click", () => {
    const lang = document.getElementById("language-select").value;
    if (confirm(`Clear ALL saved ${lang} flashcards? This cannot be undone.`)) {
      const remaining = loadSavedCards().filter((c) => c.language !== lang);
      saveCards(remaining);
      currentIndex = 0;
      refreshViewCards();
    }
  });
  document.getElementById("fc-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const knownBtn = document.getElementById("fc-known");
  const unknownBtn = document.getElementById("fc-unknown");
  knownBtn.addEventListener("mouseenter", () => { knownBtn.style.background = "#4caf50"; knownBtn.style.color = "#fff"; });
  knownBtn.addEventListener("mouseleave", () => { knownBtn.style.background = t.btnBg; knownBtn.style.color = "#4caf50"; });
  unknownBtn.addEventListener("mouseenter", () => { unknownBtn.style.background = "#ef5350"; unknownBtn.style.color = "#fff"; });
  unknownBtn.addEventListener("mouseleave", () => { unknownBtn.style.background = t.btnBg; unknownBtn.style.color = "#ef5350"; });

  function onKey(e) {
    if (!document.getElementById("flashcard-overlay")) {
      document.removeEventListener("keydown", onKey);
      return;
    }
    if (e.key === "ArrowRight") {
      currentIndex = (currentIndex + 1) % Math.max(1, viewCards.length);
      render();
    } else if (e.key === "ArrowLeft") {
      currentIndex = (currentIndex - 1 + viewCards.length) % Math.max(1, viewCards.length);
      render();
    } else if (e.key === " " || e.key === "Enter") {
      doFlip();
      e.preventDefault();
    } else if (e.key === "1") {
      doUnknown();
    } else if (e.key === "2") {
      doKnown();
    } else if (e.key === "Escape") {
      overlay.remove();
    }
  }
  document.addEventListener("keydown", onKey);
}

export function initFlashcards() {
  const flashcardBtn = document.getElementById("flashcard-btn");
  flashcardBtn.addEventListener("click", generateFlashcards);
}