// main.js - Fixed version

// Main application entry point
import { storage } from './storage.js';
import { initChat, sendMessage, addMessage, setCurrentMode, getCurrentMode, getCurrentScenario, setCurrentScenario, loadChatHistory } from './chat.js';
import { initFlashcards } from './flashcards.js';

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
export function setMode(mode, suppressMessage = false) {
  setCurrentMode(mode);
  
  // Update button styles
  Object.keys(modeButtons).forEach(key => {
    const btn = modeButtons[key];
    if (btn) {
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
    }
  });
  
  // Show/hide roleplay dropdown
  if (roleplaySelect) {
    roleplaySelect.style.display = mode === "roleplay" ? "inline-block" : "none";
  }
  
  // Send mode activation message (skip if suppressMessage is true)
  if (!suppressMessage) {
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
      }, 500);
    }
  }
}

// Load all settings
function loadAllSettings() {
  const savedTheme = storage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggleBtn.textContent = "☀️ Light Mode";
  } else {
    document.body.classList.remove("dark");
    themeToggleBtn.textContent = "🌙 Dark Mode";
  }

  const savedLang = storage.getItem("selectedLanguage");
  if (savedLang) languageSelect.value = savedLang;

  const savedDifficulty = storage.getItem("selectedDifficulty");
  if (savedDifficulty) difficultySelect.value = savedDifficulty;

  const savedTTS = storage.getItem("autoReadEnabled");
  if (savedTTS !== null) {
    autoReadEnabled = savedTTS === "true";
    ttsToggleBtn.textContent = autoReadEnabled ? "🔊 Auto-Read: ON" : "🔇 Auto-Read: OFF";
    ttsToggleBtn.classList.toggle("tts-off", !autoReadEnabled);
  }
  
  // Load saved mode without showing activation message (suppress true)
  const savedMode = storage.getItem("selectedMode");
  if (savedMode) {
    setMode(savedMode, true); // suppressMessage = true
  } else {
    // Set default mode without message
    setMode("conversation", true);
  }
}

// Save settings when they change
languageSelect.addEventListener("change", () => {
  storage.setItem("selectedLanguage", languageSelect.value);
});

difficultySelect.addEventListener("change", () => {
  storage.setItem("selectedDifficulty", difficultySelect.value);
});

themeToggleBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  themeToggleBtn.textContent = dark ? "☀️ Light Mode" : "🌙 Dark Mode";
  storage.setItem("theme", dark ? "dark" : "light");
});

ttsToggleBtn.addEventListener("click", () => {
  autoReadEnabled = !autoReadEnabled;
  storage.setItem("autoReadEnabled", autoReadEnabled ? "true" : "false");
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
    storage.setItem("selectedMode", "conversation");
  });
}

if (modeButtons.grammar) {
  modeButtons.grammar.addEventListener("click", () => {
    setMode("grammar");
    storage.setItem("selectedMode", "grammar");
  });
}

if (modeButtons.vocabulary) {
  modeButtons.vocabulary.addEventListener("click", () => {
    setMode("vocabulary");
    storage.setItem("selectedMode", "vocabulary");
  });
}

if (modeButtons.roleplay) {
  modeButtons.roleplay.addEventListener("click", () => {
    setMode("roleplay");
    storage.setItem("selectedMode", "roleplay");
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
      conversationHistory.length = 0; // Clear the array properly
      storage.removeItem("chatHistory");
      addMessage("Chat history cleared! Start a new conversation.", "system-success");
    }
  });
}

// Initialize app - FIXED ORDER
// First load chat history, then init chat, then load settings
// But we need to ensure loadChatHistory doesn't add duplicate system messages

// Clear any existing conversation history on fresh load
// Only if there are no messages in the chat window
const chatWindow = document.getElementById("chat-window");
if (chatWindow && chatWindow.children.length === 0) {
  // Fresh load - don't add any system messages yet
  loadChatHistory();
}
initChat();
initFlashcards();
// Load settings last, which will add the mode message only once
loadAllSettings();