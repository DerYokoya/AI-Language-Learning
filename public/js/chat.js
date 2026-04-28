import { storage } from './storage.js';
import { autoReadEnabled, conversationHistory, setMode, saveCurrentChat } from './main.js';

const chatWindow = document.getElementById("chat-window");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const ttsReplayBtn = document.getElementById("tts-replay-btn");
const ttsStopBtn = document.getElementById("tts-stop-btn");

let lastAIMessage = "";
let recognition = null;
let currentMode = "conversation";
let currentScenario = "restaurant";

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

const roleplayScenarios = {
  restaurant: "restaurant (ordering food, asking about menu, paying bill)",
  airport: "airport (check-in, security, boarding, baggage claim)",
  hotel: "hotel (check-in, room service, complaints, check-out)",
  shopping: "shopping mall (asking prices, sizes, returns, bargaining)",
  doctor: "doctor's office (symptoms, appointments, prescriptions)",
  jobInterview: "job interview (自我介绍, qualifications, experience, questions)",
  taxi: "taxi (directions, payment, destinations)",
  phoneCall: "phone call (making appointments, customer service, leaving messages)"
};

// Mode getters/setters
export function getCurrentMode() {
  return currentMode;
}

export function setCurrentMode(mode) {
  currentMode = mode;
}

export function getCurrentScenario() {
  return currentScenario;
}

export function setCurrentScenario(scenario) {
  currentScenario = scenario;
}

// Mode-specific prompt builder
function getModePrompt(userMessage, targetLanguage, difficulty) {
  const basePrompt = `You are a ${targetLanguage} language tutor. The student is at ${difficulty} level. `;
  
  switch(currentMode) {
    case "grammar":
      return basePrompt + `This is GRAMMAR CORRECTION mode. Focus on correcting the student's grammar, explaining the rule, and providing the correct version. 
      Student's message: "${userMessage}"
      
      Respond in this format:
      📝 **Correction**: [corrected version]
      📖 **Rule Explanation**: [simple grammar rule explanation]
      💡 **Tip**: [helpful tip to remember this rule]
      🎯 **Practice**: [short exercise for the student]`;
      
    case "vocabulary":
      return basePrompt + `This is VOCABULARY BUILDING mode. Focus on teaching new words, synonyms, antonyms, and usage.
      Student's message: "${userMessage}"
      
      If the student used a word incorrectly or asks about a word, respond in this format:
      📚 **Word/Phrase**: [the word/phrase being taught]
      🌎 **Meaning**: [meaning in English]
      📝 **Example Sentences**: 
      1. [sentence 1 in ${targetLanguage}]
      2. [sentence 2 in ${targetLanguage}]
      🔄 **Related Words**: [synonyms, antonyms, or related vocabulary]
      ✍️ **Practice**: [use this word in a sentence challenge]
      
      If the student just wrote a normal message, teach 2-3 new relevant vocabulary words based on their message.`;
      
    case "roleplay":
      const scenario = roleplayScenarios[currentScenario] || roleplayScenarios.restaurant;
      return basePrompt + `This is ROLEPLAY mode. Scenario: ${scenario}.
      You are playing a character appropriate for this scenario (waiter, receptionist, doctor, etc.).
      Stay in character. Respond naturally as that person would.
      Keep your responses to 1-2 sentences so the student can practice back-and-forth conversation.
      Student says: "${userMessage}"
      
      Respond as your character naturally would. After every 3 exchanges, provide a small feedback tip in (parentheses).`;
      
    default: // conversation mode
      return basePrompt + `This is CONVERSATION PRACTICE mode. Have a natural conversation with the student.
      Correct their mistakes gently. Ask follow-up questions to keep the conversation going.
      Student's message: "${userMessage}"
      
      Respond naturally, then ask a relevant follow-up question. Keep your response encouraging and educational.`;
  }
}

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

  saveCurrentChat();
}

export function loadChatHistory(history = null) {
  const messages = history || (() => {
    const saved = storage.getItem("chatHistory");
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch (err) {
      console.warn("Failed to parse legacy chat history", err);
      return [];
    }
  })();

  messages.forEach((m) => {
    const msg = document.createElement("div");
    msg.classList.add("message", m.sender);
    msg.innerHTML = m.html || marked.parse(m.text || "");
    chatWindow.appendChild(msg);

    if (m.sender === "user" || m.sender === "ai") {
      conversationHistory.push({
        sender: m.sender,
        text: m.text || msg.textContent,
      });
    }
  });
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

  const prompt = getModePrompt(text, targetLanguage, difficulty);

  try {
    const response = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt,
        targetLanguage,
        difficulty,
        mode: currentMode,
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
  // If listening practice is active, let listening.js handle it
  if (window.listeningPracticeActive) {
    return; // Don't process here, let listening.js handle it
  }
  
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
  console.log("Chat module initialized with learning modes");
}