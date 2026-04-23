const chatWindow = document.getElementById("chat-window");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

const languageSelect = document.getElementById("language-select");
const micBtn = document.getElementById("mic-btn");
const listenBtn = document.getElementById("listen-practice-btn");

const ttsToggleBtn = document.getElementById("tts-toggle-btn");
const ttsReplayBtn = document.getElementById("tts-replay-btn");
const difficultySelect = document.getElementById("difficulty-select");

const flashcardBtn = document.getElementById("flashcard-btn");
const themeToggleBtn = document.getElementById("theme-toggle-btn");

let lastAIMessage = "";
let conversationHistory = [];
let autoReadEnabled = true;

const langMap = {
  Spanish: "es-ES",
  French: "fr-FR",
  German: "de-DE",
  Italian: "it-IT",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  "Mandarin Chinese": "zh-CN",
  English: "en-US",
};

// ---------- FLASHCARD STORAGE HELPERS ----------
// Keys: "fc_cards" = array of {id, front, back, language, difficulty, known, addedAt, reviewCount}
//       "fc_progress" = {known: [], unknown: []}  (legacy - merged into cards)

function loadSavedCards() {
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

function markCard(id, known) {
  const cards = loadSavedCards();
  const card = cards.find((c) => c.id === id);
  if (card) {
    card.known = known;
    card.reviewCount = (card.reviewCount || 0) + 1;
    saveCards(cards);
  }
}

function getStats(cards) {
  const total = cards.length;
  const known = cards.filter((c) => c.known).length;
  const unknown = total - known;
  return { total, known, unknown };
}

// ---------- LOAD ALL SETTINGS FIRST ----------
function loadAllSettings() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggleBtn.textContent = "☀️ Light Mode";
  } else {
    document.body.classList.remove("dark");
    themeToggleBtn.textContent = "🌙 Dark Mode";
  }

  const savedLang = localStorage.getItem("selectedLanguage");
  if (savedLang) languageSelect.value = savedLang;

  const savedDifficulty = localStorage.getItem("selectedDifficulty");
  if (savedDifficulty) difficultySelect.value = savedDifficulty;

  const savedTTS = localStorage.getItem("autoReadEnabled");
  if (savedTTS !== null) {
    autoReadEnabled = savedTTS === "true";
    ttsToggleBtn.textContent = autoReadEnabled ? "🔊 Auto-Read: ON" : "🔇 Auto-Read: OFF";
    ttsToggleBtn.classList.toggle("tts-off", !autoReadEnabled);
  }
}

loadAllSettings();

// ---------- SAVE SETTINGS WHEN THEY CHANGE ----------
languageSelect.addEventListener("change", () => {
  localStorage.setItem("selectedLanguage", languageSelect.value);
});

difficultySelect.addEventListener("change", () => {
  localStorage.setItem("selectedDifficulty", difficultySelect.value);
});

themeToggleBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  themeToggleBtn.textContent = dark ? "☀️ Light Mode" : "🌙 Dark Mode";
  localStorage.setItem("theme", dark ? "dark" : "light");
});

ttsToggleBtn.addEventListener("click", () => {
  autoReadEnabled = !autoReadEnabled;
  localStorage.setItem("autoReadEnabled", autoReadEnabled ? "true" : "false");
  ttsToggleBtn.textContent = autoReadEnabled ? "🔊 Auto-Read: ON" : "🔇 Auto-Read: OFF";
  ttsToggleBtn.classList.toggle("tts-off", !autoReadEnabled);

  if (autoReadEnabled) {
    addMessage("🔊 Text-to-Speech active. I'll speak my responses.", "system-success");
  } else {
    addMessage("🔇 TTS turned off.", "system-success");
  }
});

// ---------- TTS REPLAY ----------
ttsReplayBtn.addEventListener("click", () => {
  if (!lastAIMessage) {
    addMessage("⚠️ No AI message to replay yet.", "system-error");
    return;
  }

  const targetLanguage = languageSelect.value;
  const langCode = langMap[targetLanguage] || "en-US";

  const clean = stripMarkdown(lastAIMessage);
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = langCode;
  speechSynthesis.speak(utter);
});

speechSynthesis.onvoiceschanged = () => {
  console.log("Voices loaded:", speechSynthesis.getVoices());
};

function waitForVoices() {
  return new Promise((resolve) => {
    let voices = speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices);
      return;
    }
    speechSynthesis.onvoiceschanged = () => {
      voices = speechSynthesis.getVoices();
      resolve(voices);
    };
  });
}

// ---------- STRIP MARKDOWN FOR SPEECH ----------
function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_{1,2}(.*?)_{1,2}/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/#(\w+)/g, "$1")
    .replace(/[!?]/g, ".")
    .trim();
}

// ---------- MESSAGE BUBBLES ----------
function addMessage(text, sender) {
  if (!text) {
    console.warn("⚠ addMessage called with empty text");
    return;
  }

  const msg = document.createElement("div");

  if (sender === "user") {
    msg.classList.add("message", "user");
  } else if (sender === "system-error") {
    msg.classList.add("message", "system-error");
  } else if (sender === "system-success") {
    msg.classList.add("message", "system-success");
  } else {
    msg.classList.add("message", "ai");
  }

  msg.innerHTML = marked.parse(text);
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  if (sender === "user" || sender === "ai") {
    conversationHistory.push({ sender, text });
  }

  saveChatHistory();
}

function saveChatHistory() {
  const messages = [];
  const messageElements = document.querySelectorAll(".message");

  messageElements.forEach((msg) => {
    let sender = "";
    if (msg.classList.contains("user")) sender = "user";
    else if (msg.classList.contains("ai")) sender = "ai";
    else if (msg.classList.contains("system-error")) sender = "system-error";
    else if (msg.classList.contains("system-success")) sender = "system-success";
    else sender = "ai";

    messages.push({
      sender: sender,
      text: msg.textContent || msg.innerText,
      html: msg.innerHTML,
    });
  });

  localStorage.setItem("chatHistory", JSON.stringify(messages));
}

function loadChatHistory() {
  const saved = localStorage.getItem("chatHistory");
  if (!saved) return;

  const messages = JSON.parse(saved);
  messages.forEach((m) => {
    const msg = document.createElement("div");
    msg.classList.add("message", m.sender);
    msg.innerHTML = m.html;
    chatWindow.appendChild(msg);

    if (m.sender === "user" || m.sender === "ai") {
      conversationHistory.push({
        sender: m.sender,
        text: m.text,
      });
    }
  });

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

const clearChatBtn = document.getElementById("clear-chat-btn");
if (clearChatBtn) {
  clearChatBtn.addEventListener("click", () => {
    if (confirm("Clear all chat history?")) {
      chatWindow.innerHTML = "";
      conversationHistory = [];
      localStorage.removeItem("chatHistory");
      addMessage("Chat history cleared! Start a new conversation.", "system-success");
    }
  });
}

// ---------- TYPING INDICATOR ----------
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("typing");
  typing.id = "typing-indicator";

  typing.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;

  chatWindow.appendChild(typing);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideTyping() {
  const typing = document.getElementById("typing-indicator");
  if (typing) typing.remove();
}

// ---------- TEXT TO SPEECH ----------
async function speak(text, langCode) {
  if (!autoReadEnabled) return;

  await waitForVoices();

  const clean = stripMarkdown(text);
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = langCode;

  const voice = getVoiceForLang(langCode);

  if (!voice) {
    addMessage(
      `⚠️ No voice installed for ${langCode}. Please install a voice for this language in your system settings.`,
      "system-error"
    );
  } else {
    utter.voice = voice;
  }

  utter.rate = 1;
  utter.pitch = 1;
  speechSynthesis.speak(utter);
}

// ---------- SPEECH RECOGNITION SETUP ----------
let recognition;
if ("webkitSpeechRecognition" in window) {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => console.log("🎤 Voice recognition started");
  recognition.onend = () => console.log("🛑 Voice recognition ended");
  recognition.onerror = (e) => console.log("❌ Speech error:", e.error);

  recognition.onresult = function (event) {
    const transcript = event.results[0][0].transcript;
    userInput.value = transcript;
    micBtn.classList.remove("recording");
  };
}

// ---------- SEND MESSAGE ----------
async function sendMessage() {
  const text = userInput.value.trim();
  const targetLanguage = languageSelect.value;
  const difficulty = difficultySelect.value;

  if (!text) return;

  addMessage(text, "user");
  userInput.value = "";
  showTyping();

  try {
    const response = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: text,
        targetLanguage,
        difficulty,
      }),
    });

    hideTyping();

    if (!response.ok) {
      addMessage("⚠️ Server error. Please try again.", "ai");
      return;
    }

    const data = await response.json();

    if (!data.reply) {
      addMessage("⚠️ AI returned an empty response.", "ai");
      return;
    }

    lastAIMessage = data.reply;
    addMessage(data.reply, "ai");
    speak(data.reply, langMap[targetLanguage]);
  } catch (err) {
    hideTyping();
    addMessage("⚠️ Network error. Check your server.", "ai");
    console.error(err);
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

// ---------- MIC BUTTON ----------
micBtn.addEventListener("click", () => {
  if (!recognition) return alert("Speech recognition not supported in this browser");

  const targetLanguage = languageSelect.value;
  recognition.lang = langMap[targetLanguage] || "en-US";

  micBtn.classList.add("recording");
  recognition.start();
});

// ---------- LISTENING PRACTICE ----------
listenBtn.addEventListener("click", async () => {
  const targetLanguage = languageSelect.value;
  const difficulty = difficultySelect.value;

  showTyping();
  const response = await fetch("/api/ai/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Give me a short sentence for listening practice.",
      targetLanguage,
      difficulty,
    }),
  });
  hideTyping();

  const data = await response.json();
  const sentence = data.reply;
  lastAIMessage = sentence;

  addMessage(sentence, "ai");

  const langCode = langMap[targetLanguage] || "en-US";
  if (autoReadEnabled) {
    const cleanSentence = stripMarkdown(sentence);
    const utter = new SpeechSynthesisUtterance(cleanSentence);
    utter.lang = langCode;
    speechSynthesis.speak(utter);
  }

  addMessage("Now repeat the sentence aloud.", "ai");

  recognition.lang = langCode;
  micBtn.classList.add("recording");
  recognition.start();

  recognition.onresult = async function (event) {
    micBtn.classList.remove("recording");
    const attempt = event.results[0][0].transcript;

    addMessage(attempt, "user");

    showTyping();
    const evalResponse = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Evaluate my pronunciation of this sentence: "${sentence}". My attempt: "${attempt}".`,
        targetLanguage,
      }),
    });
    hideTyping();

    const evalData = await evalResponse.json();
    lastAIMessage = evalData.reply;
    addMessage(evalData.reply, "ai");
    speak(evalData.reply, langCode);
  };
});

const ttsStopBtn = document.getElementById("tts-stop-btn");

ttsStopBtn.addEventListener("click", () => {
  speechSynthesis.cancel();
  addMessage("🔇 Voice playback stopped.", "system-success");
});

let cachedVoices = [];
speechSynthesis.onvoiceschanged = () => {
  cachedVoices = speechSynthesis.getVoices();
  console.log("Voices loaded:", cachedVoices);
};

function getVoiceForLang(langCode) {
  const voices = cachedVoices.length ? cachedVoices : speechSynthesis.getVoices();
  const exact = voices.find((v) => v.lang === langCode);
  if (exact) return exact;
  const prefix = langCode.split("-")[0];
  return voices.find((v) => v.lang.startsWith(prefix)) || null;
}

// ---------- FLASHCARDS ----------
flashcardBtn.addEventListener("click", async () => {
  const targetLanguage = languageSelect.value;
  const difficulty = difficultySelect.value;

  const historyText = conversationHistory
    .map((m) => `${m.sender}: ${m.text}`)
    .join("\n");

  showTyping();

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

  hideTyping();

  const data = await response.json();
  const newCards = parseFlashcards(data.reply);
  const { all: allCards, added } = mergeNewCards(newCards, targetLanguage, difficulty);

  // Filter to current language cards; show unknown first, then known
  const langCards = allCards
    .filter((c) => c.language === targetLanguage)
    .sort((a, b) => {
      if (a.known === b.known) return 0;
      return a.known ? 1 : -1; // unknown first
    });

  startFlashcardMode(langCards, added);
});

function parseFlashcards(text) {
  const blocks = text.split("CARD:").slice(1);

  return blocks.map((block) => {
    const front = block.match(/Front:\s*([^\n]+)/)?.[1]?.trim();
    const backMatch = block.match(/Back:\s*([\s\S]*?)(?=CARD:|$)/);
    const back = backMatch ? backMatch[1].trim() : "";
    return { front, back };
  });
}

function startFlashcardMode(cards, newlyAdded = 0) {
  cards = cards.filter((c) => c.front && c.back);

  if (!cards.length) {
    addMessage("⚠️ Couldn't generate flashcards. Try again after a short conversation.", "system-error");
    return;
  }

  let currentIndex = 0;
  let flipped = false;
  const dark = document.body.classList.contains("dark");

  // Theme-aware color palette
  const t = {
    bg:          dark ? "#2a2a2a" : "#fff",
    text:        dark ? "#f1f1f1" : "#111",
    subtext:     dark ? "#aaa"    : "#888",
    hint:        dark ? "#777"    : "#aaa",
    cardBg:      dark ? "#3a3a3a" : "#f5f7ff",
    cardBorder:  dark ? "#4a5080" : "#d0d8ff",
    cardFlipped: dark ? "#1b3b1f" : "#e8f5e9",
    progressBg:  dark ? "#444"    : "#eee",
    btnBg:       dark ? "#3a3a3a" : "#fff",
    btnBorder:   dark ? "#555"    : "#ccc",
    btnText:     dark ? "#ddd"    : "#333",
    tabInactBg:  dark ? "#3a3a3a" : "#fff",
    tabInactTxt: dark ? "#bbb"    : "#555",
    tabInactBdr: dark ? "#555"    : "#ccc",
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
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div id="fc-counter" style="font-size:13px; color:${t.subtext};"></div>
        <div id="fc-stats" style="font-size:13px; color:${t.subtext};"></div>
      </div>

      ${newlyAdded > 0 ? `<div id="fc-new-badge" style="font-size:12px; color:#7b8ef8; margin-bottom:8px; font-weight:600;">+${newlyAdded} new card${newlyAdded > 1 ? 's' : ''} added to your deck!</div>` : ""}

      <!-- Progress bar -->
      <div style="background:${t.progressBg}; border-radius:999px; height:6px; margin-bottom:16px; overflow:hidden;">
        <div id="fc-progress-bar" style="height:100%; background: linear-gradient(90deg, #5b6af0, #8b9cf8); border-radius:999px; transition: width 0.3s;"></div>
      </div>

      <!-- Card -->
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

      <!-- Navigation -->
      <div style="display:flex; gap:10px; margin-top:16px; justify-content:center; flex-wrap: wrap;">
        <button id="fc-prev" style="padding:10px 18px; border-radius:9px; border:1px solid ${t.btnBorder}; cursor:pointer; font-size:14px; background:${t.btnBg}; color:${t.btnText};">← Prev</button>
        <button id="fc-flip" style="padding:10px 18px; border-radius:9px; background:#5b6af0; color:#fff; border:none; cursor:pointer; font-size:14px;">Flip</button>
        <button id="fc-next" style="padding:10px 18px; border-radius:9px; border:1px solid ${t.btnBorder}; cursor:pointer; font-size:14px; background:${t.btnBg}; color:${t.btnText};">Next →</button>
      </div>

      <!-- Known / Don't Know buttons -->
      <div style="display:flex; gap:12px; margin-top:14px; justify-content:center; flex-wrap:wrap; align-items:center;">
        <button id="fc-unknown" style="
          padding:11px 24px; border-radius:10px; border:2px solid #ef5350;
          background:${t.btnBg}; color:#ef5350; cursor:pointer; font-size:14px; font-weight:600;
          transition: background 0.15s, color 0.15s;
        ">✗ Don't Know</button>
        <button id="fc-known" style="
          padding:11px 24px; border-radius:10px; border:2px solid #4caf50;
          background:${t.btnBg}; color:#4caf50; cursor:pointer; font-size:14px; font-weight:600;
          transition: background 0.15s, color 0.15s;
        ">✓ Know It</button>
      </div>
      <!-- Auto-skip toggle -->
      <div style="margin-top:10px; text-align:center;">
        <button id="fc-autoskip-toggle" style="
          padding:5px 16px; border-radius:999px; border:1px solid ${t.btnBorder};
          background:${t.btnBg}; color:${t.hint}; cursor:pointer; font-size:12px;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          position:relative; z-index:10;
        ">⏭ Auto-skip: OFF</button>
      </div>

      <!-- Review filter tabs -->
      <div style="display:flex; gap:8px; margin-top:16px; justify-content:center; font-size:13px; flex-wrap:wrap;">
        <button id="fc-tab-all" class="fc-tab fc-tab-active" style="padding:5px 14px; border-radius:999px; border:1px solid #5b6af0; background:#5b6af0; color:#fff; cursor:pointer; font-size:12px;">All</button>
        <button id="fc-tab-unknown" class="fc-tab" style="padding:5px 14px; border-radius:999px; border:1px solid ${t.tabInactBdr}; background:${t.tabInactBg}; color:${t.tabInactTxt}; cursor:pointer; font-size:12px;">❓ Study</button>
        <button id="fc-tab-known" class="fc-tab" style="padding:5px 14px; border-radius:999px; border:1px solid ${t.tabInactBdr}; background:${t.tabInactBg}; color:${t.tabInactTxt}; cursor:pointer; font-size:12px;">✓ Mastered</button>
        <button id="fc-clear-deck" style="padding:5px 14px; border-radius:999px; border:1px solid #f44336; background:${t.btnBg}; color:#f44336; cursor:pointer; font-size:12px;">🗑 Clear Deck</button>
      </div>

      <button id="fc-close" style="
        margin-top:18px; background:none; border:none; color:${t.hint};
        font-size:13px; cursor:pointer; text-decoration:underline;
      ">Close flashcards</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Active view: "all" | "unknown" | "known"
  let activeView = "all";
  let viewCards = [...cards];
  let autoSkip = false;

  function getViewCards() {
    const all = loadSavedCards().filter(
      (c) => c.language === (languageSelect.value)
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
    const allLang = loadSavedCards().filter((c) => c.language === languageSelect.value);
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

  // Initial render
  render();

  // Events
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
    const lang = languageSelect.value;
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

  // Hover effects for known/unknown buttons
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

// Load chat history after everything is set up
loadChatHistory();