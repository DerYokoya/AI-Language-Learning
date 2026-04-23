// Main application entry point
import { initChat, sendMessage } from './chat.js';
import { initFlashcards } from './flashcards.js';
import { loadChatHistory, addMessage } from './chat.js';

// DOM Elements
const languageSelect = document.getElementById("language-select");
const difficultySelect = document.getElementById("difficulty-select");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const ttsToggleBtn = document.getElementById("tts-toggle-btn");

// Global state
export let autoReadEnabled = true;
export let conversationHistory = [];

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
  localStorage.setItem("autoReadEnabled", autoReadEnabled);
  ttsToggleBtn.textContent = autoReadEnabled ? "🔊 Auto-Read: ON" : "🔇 Auto-Read: OFF";
  ttsToggleBtn.classList.toggle("tts-off", !autoReadEnabled);

  if (autoReadEnabled) {
    addMessage("🔊 Text-to-Speech active. I'll speak my responses.", "system-success");
  } else {
    addMessage("🔇 TTS turned off.", "system-success");
  }
});

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