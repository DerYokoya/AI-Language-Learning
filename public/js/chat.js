import { autoReadEnabled, conversationHistory } from './main.js';

const chatWindow = document.getElementById("chat-window");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const ttsReplayBtn = document.getElementById("tts-replay-btn");
const ttsStopBtn = document.getElementById("tts-stop-btn");

let lastAIMessage = "";
let recognition = null;

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

// Speech synthesis setup
let cachedVoices = [];
speechSynthesis.onvoiceschanged = () => {
  cachedVoices = speechSynthesis.getVoices();
};

function getVoiceForLang(langCode) {
  const voices = cachedVoices.length ? cachedVoices : speechSynthesis.getVoices();
  const exact = voices.find((v) => v.lang === langCode);
  if (exact) return exact;
  const prefix = langCode.split("-")[0];
  return voices.find((v) => v.lang.startsWith(prefix)) || null;
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

export function stripMarkdown(text) {
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

export async function speak(text, langCode) {
  if (!autoReadEnabled) return;

  await waitForVoices();
  const clean = stripMarkdown(text);
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = langCode;
  
  const voice = getVoiceForLang(langCode);
  if (voice) utter.voice = voice;

  utter.rate = 1;
  utter.pitch = 1;
  speechSynthesis.speak(utter);
}

export function addMessage(text, sender) {
  if (!text) {
    console.warn("⚠ addMessage called with empty text");
    return;
  }

  const msg = document.createElement("div");
  
  if (sender === "user") msg.classList.add("message", "user");
  else if (sender === "system-error") msg.classList.add("message", "system-error");
  else if (sender === "system-success") msg.classList.add("message", "system-success");
  else msg.classList.add("message", "ai");

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

export function loadChatHistory() {
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

function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("typing");
  typing.id = "typing-indicator";
  typing.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  chatWindow.appendChild(typing);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideTyping() {
  const typing = document.getElementById("typing-indicator");
  if (typing) typing.remove();
}

export async function sendMessage() {
  const text = userInput.value.trim();
  const targetLanguage = document.getElementById("language-select").value;
  const difficulty = document.getElementById("difficulty-select").value;

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

// Speech recognition setup
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

// Event listeners
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

micBtn.addEventListener("click", () => {
  if (!recognition) return alert("Speech recognition not supported in this browser");
  const targetLanguage = document.getElementById("language-select").value;
  recognition.lang = langMap[targetLanguage] || "en-US";
  micBtn.classList.add("recording");
  recognition.start();
});

ttsReplayBtn.addEventListener("click", () => {
  if (!lastAIMessage) {
    addMessage("⚠️ No AI message to replay yet.", "system-error");
    return;
  }
  const targetLanguage = document.getElementById("language-select").value;
  const langCode = langMap[targetLanguage] || "en-US";
  const clean = stripMarkdown(lastAIMessage);
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = langCode;
  speechSynthesis.speak(utter);
});

ttsStopBtn.addEventListener("click", () => {
  speechSynthesis.cancel();
  addMessage("🔇 Voice playback stopped.", "system-success");
});

export function initChat() {
  console.log("Chat module initialized");
}