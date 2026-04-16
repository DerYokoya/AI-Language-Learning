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

themeToggleBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  const dark = document.body.classList.contains("dark");
  themeToggleBtn.textContent = dark ? "☀️ Light Mode" : "🌙 Dark Mode";
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

// ---------- TTS TOGGLE ----------
let autoReadEnabled = true;

ttsToggleBtn.addEventListener("click", () => {
  autoReadEnabled = !autoReadEnabled;
  ttsToggleBtn.textContent = autoReadEnabled
    ? "🔊 Auto-Read: ON"
    : "🔇 Auto-Read: OFF";
  ttsToggleBtn.classList.toggle("tts-off", !autoReadEnabled);

  if (autoReadEnabled) {
    addMessage(
      "🔊 Text-to-Speech active. I'll speak my responses.",
      "system-success",
    );
  } else {
    addMessage("🔇 TTS turned off.", "system-success");
  }
});

// ---------- STRIP MARKDOWN FOR SPEECH ----------
function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`[^`]*`/g, "") // inline code
    .replace(/#{1,6}\s*/g, "") // headings
    .replace(/^\s*[-*+]\s+/gm, "") // bullets
    .replace(/^>\s+/gm, "") // blockquotes
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/\*(.*?)\*/g, "$1") // italic
    .replace(/_{1,2}(.*?)_{1,2}/g, "$1") // underscores
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // links
    .replace(/\n{2,}/g, ". ") // paragraph → pause
    .replace(/\n/g, " ") // newlines
    .replace(/#(\w+)/g, "$1") // remove inline hashtags
    .replace(/[!?]/g, ".") // replace with a soft stop
    .trim();
}

// ---------- MESSAGE BUBBLES ----------
function addMessage(text, sender) {
  if (!text) {
    console.warn("⚠ addMessage called with empty text");
    return;
  }

  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerHTML = marked.parse(text);
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  conversationHistory.push({ sender, text });
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

  await waitForVoices(); // <-- ensures voices are loaded

  const clean = stripMarkdown(text);
  const utter = new SpeechSynthesisUtterance(clean);

  utter.lang = langCode;

  const voice = getVoiceForLang(langCode);

  if (!voice) {
    addMessage(
      `⚠️ No voice installed for ${langCode}.  
      Please install a voice for this language in your system settings.`,
      "system-error",
    );
  } else {
    utter.voice = voice;
  }

  utter.rate = 1;
  utter.pitch = 1;

  speechSynthesis.speak(utter);
}

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
  if (!recognition)
    return alert("Speech recognition not supported in this browser");

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
  speechSynthesis.cancel(); // <-- kills ALL ongoing speech instantly
  addMessage("🔇 Voice playback stopped.", "system-success");
});

let cachedVoices = [];
speechSynthesis.onvoiceschanged = () => {
  cachedVoices = speechSynthesis.getVoices();
  console.log("Voices loaded:", cachedVoices);
};

function getVoiceForLang(langCode) {
  const voices = cachedVoices.length
    ? cachedVoices
    : speechSynthesis.getVoices();
  const exact = voices.find((v) => v.lang === langCode);
  if (exact) return exact;
  const prefix = langCode.split("-")[0];
  return voices.find((v) => v.lang.startsWith(prefix)) || null;
}

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
  const cards = parseFlashcards(data.reply);
  startFlashcardMode(cards);
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

// ---------- FLASHCARD MODE ----------
function startFlashcardMode(cards) {
  // Filter out any cards that failed to parse
  cards = cards.filter((c) => c.front && c.back);

  if (!cards.length) {
    addMessage(
      "⚠️ Couldn't generate flashcards. Try again after a short conversation.",
      "system-error",
    );
    return;
  }

  let currentIndex = 0;
  let flipped = false;

  // Build overlay
  const overlay = document.createElement("div");
  overlay.id = "flashcard-overlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; z-index: 9999; font-family: inherit;
  `;

  overlay.innerHTML = `
    <div id="fc-container" style="
      background: #fff; color: #111; border-radius: 16px;
      padding: 32px 40px; max-width: 480px; width: 90%; text-align: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.4);
    ">
      <div id="fc-counter" style="font-size:13px; color:#888; margin-bottom:12px;"></div>
      <div id="fc-card" style="
  background: #f5f7ff; border-radius: 12px; padding: 36px 24px;
  min-height: 120px; display:flex; align-items:center; justify-content:center;
  font-size: 1.5rem; cursor: pointer; transition: background 0.2s;
  user-select: none; border: 2px solid #d0d8ff;
  white-space: pre-wrap; /* To ensure a blank new line separate the translation and the example */
">
  <span id="fc-text"></span>
</div>

        <span id="fc-text"></span>
      </div>
      <p id="fc-hint" style="font-size:13px; color:#aaa; margin-top:10px;">
        Click the card to flip
      </p>
      <div style="display:flex; gap:12px; margin-top:20px; justify-content:center;">
        <button id="fc-prev" style="padding:10px 22px; border-radius:8px; border:1px solid #ccc; cursor:pointer; font-size:15px;">← Prev</button>
        <button id="fc-flip" style="padding:10px 22px; border-radius:8px; background:#5b6af0; color:#fff; border:none; cursor:pointer; font-size:15px;">Flip</button>
        <button id="fc-next" style="padding:10px 22px; border-radius:8px; border:1px solid #ccc; cursor:pointer; font-size:15px;">Next →</button>
      </div>
      <button id="fc-close" style="
        margin-top:18px; background:none; border:none; color:#888;
        font-size:13px; cursor:pointer; text-decoration:underline;
      ">Close flashcards</button>
    </div>
  `;

  document.body.appendChild(overlay);

  function render() {
    const card = cards[currentIndex];
    flipped = false;
    document.getElementById("fc-text").textContent = card.front;
    document.getElementById("fc-card").style.background = "#f5f7ff";
    document.getElementById("fc-hint").textContent = "Click the card to flip";
    document.getElementById("fc-counter").textContent =
      `Card ${currentIndex + 1} of ${cards.length}`;
  }

  function doFlip() {
    const card = cards[currentIndex];
    flipped = !flipped;
    document.getElementById("fc-text").textContent = flipped
      ? card.back
      : card.front;
    document.getElementById("fc-card").style.background = flipped
      ? "#e8f5e9"
      : "#f5f7ff";
    document.getElementById("fc-hint").textContent = flipped
      ? "Back side"
      : "Click the card to flip";
  }

  render();

  document.getElementById("fc-card").addEventListener("click", doFlip);
  document.getElementById("fc-flip").addEventListener("click", doFlip);

  document.getElementById("fc-prev").addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + cards.length) % cards.length;
    render();
  });

  document.getElementById("fc-next").addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % cards.length;
    render();
  });

  document.getElementById("fc-close").addEventListener("click", () => {
    overlay.remove();
  });

  // Close on backdrop click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Keyboard navigation
  function onKey(e) {
    if (!document.getElementById("flashcard-overlay")) {
      document.removeEventListener("keydown", onKey);
      return;
    }
    if (e.key === "ArrowRight") {
      currentIndex = (currentIndex + 1) % cards.length;
      render();
    } else if (e.key === "ArrowLeft") {
      currentIndex = (currentIndex - 1 + cards.length) % cards.length;
      render();
    } else if (e.key === " " || e.key === "Enter") {
      doFlip();
      e.preventDefault();
    } else if (e.key === "Escape") {
      overlay.remove();
    }
  }
  document.addEventListener("keydown", onKey);
}
