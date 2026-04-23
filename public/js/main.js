// Main application entry point
import { initChat, sendMessage, addMessage, setCurrentMode, getCurrentMode, getCurrentScenario, setCurrentScenario } from './chat.js';
import { initFlashcards } from './flashcards.js';
import { loadChatHistory } from './chat.js';

// DOM Elements
const languageSelect = document.getElementById("language-select");
const difficultySelect = document.getElementById("difficulty-select");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const ttsToggleBtn = document.getElementById("tts-toggle-btn");

// Learning mode elements
const modeButtons = {
  conversation: document.getElementById("mode-conversation"),
  grammar: document.getElementById("mode-grammar"),
  vocabulary: document.getElementById("mode-vocabulary"),
  roleplay: document.getElementById("mode-roleplay")
};
const roleplaySelect = document.getElementById("roleplay-scenario");

// Global state
export let autoReadEnabled = true;
export let conversationHistory = [];

// Mode switching
export function setMode(mode) {
  setCurrentMode(mode);
  
  // Update button styles
  Object.keys(modeButtons).forEach(key => {
    const btn = modeButtons[key];
    if (key === mode) {
      btn.classList.add("active-mode");
      btn.style.background = "#5b6af0";
      btn.style.color = "#fff";
      btn.style.borderColor = "#5b6af0";
    } else {
      btn.classList.remove("active-mode");
      btn.style.background = "var(--btn-bg, #f0f0f0)";
      btn.style.color = "var(--btn-text, #333)";
      btn.style.borderColor = "var(--border-color, #ccc)";
    }
  });
  
  // Show/hide roleplay dropdown
  if (mode === "roleplay") {
    if (roleplaySelect) roleplaySelect.style.display = "inline-block";
  } else {
    if (roleplaySelect) roleplaySelect.style.display = "none";
  }
  
  // Send mode activation message
  const modeMessages = {
    conversation: "💬 **Conversation Practice Mode** activated! Let's have a natural conversation. I'll correct you gently and ask follow-up questions.",
    grammar: "📝 **Grammar Correction Mode** activated! I'll focus on fixing your sentences and explaining grammar rules. Try writing something!",
    vocabulary: "📚 **Vocabulary Building Mode** activated! I'll teach you new words and phrases. What would you like to learn about?",
    roleplay: `🎭 **Roleplay Mode** activated! Get ready to practice real-life scenarios!`
  };
  
  addMessage(modeMessages[mode], "system-success");
  
  // For roleplay, add intro message based on scenario
  if (mode === "roleplay") {
    const scenario = getCurrentScenario();
    const introMessages = {
      restaurant: "🍽️ Welcome to our restaurant! How many people are in your party today?",
      airport: "✈️ Good morning! May I see your passport and ticket please?",
      hotel: "🏨 Welcome to Hotel Grand! Do you have a reservation with us?",
      shopping: "🛍️ Hello! Welcome to our store. Can I help you find something specific?",
      doctor: "🏥 Hello, I'm Dr. Smith. What seems to be the problem today?",
      jobInterview: "💼 Nice to meet you! Tell me a bit about your background and experience.",
      taxi: "🚕 Where to, please?",
      phoneCall: "📞 Hello, you've reached Customer Service. How may I help you today?"
    };
    setTimeout(() => {
      addMessage(introMessages[scenario] || "Hello! How can I help you today?", "ai");
      // Need to import speak function or trigger TTS here
    }, 500);
  }
}

// Load all settings
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
  
  const savedMode = localStorage.getItem("selectedMode");
  if (savedMode) setMode(savedMode);
}

// Save settings when they change
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

// Mode button event listeners
if (modeButtons.conversation) {
  modeButtons.conversation.addEventListener("click", () => {
    setMode("conversation");
    localStorage.setItem("selectedMode", "conversation");
  });
}

if (modeButtons.grammar) {
  modeButtons.grammar.addEventListener("click", () => {
    setMode("grammar");
    localStorage.setItem("selectedMode", "grammar");
  });
}

if (modeButtons.vocabulary) {
  modeButtons.vocabulary.addEventListener("click", () => {
    setMode("vocabulary");
    localStorage.setItem("selectedMode", "vocabulary");
  });
}

if (modeButtons.roleplay) {
  modeButtons.roleplay.addEventListener("click", () => {
    setMode("roleplay");
    localStorage.setItem("selectedMode", "roleplay");
  });
}

// Roleplay scenario selector
if (roleplaySelect) {
  roleplaySelect.addEventListener("change", (e) => {
    setCurrentScenario(e.target.value);
    if (getCurrentMode() === "roleplay") {
      addMessage(`🎭 Scenario changed to: ${e.target.value.replace(/([A-Z])/g, ' $1').toLowerCase()}`, "system-success");
    }
  });
}

// Clear chat button
const clearChatBtn = document.getElementById("clear-chat-btn");
if (clearChatBtn) {
  clearChatBtn.addEventListener("click", () => {
    if (confirm("Clear all chat history?")) {
      const chatWindow = document.getElementById("chat-window");
      chatWindow.innerHTML = "";
      conversationHistory = [];
      localStorage.removeItem("chatHistory");
      addMessage("Chat history cleared! Start a new conversation.", "system-success");
    }
  });
}

// Initialize app
loadAllSettings();
loadChatHistory();
initChat();
initFlashcards();