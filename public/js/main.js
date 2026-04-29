// Main application entry point
import { appStorage } from "./appStorage.js";
import {
  initChat,
  addMessage,
  setCurrentMode,
  getCurrentMode,
  getCurrentScenario,
  setCurrentScenario,
  loadChatHistory,
} from "./chat.js";
import { initFlashcards } from "./flashcards.js";
import { startListeningPractice } from "./listening.js";

// DOM Elements
const languageSelect  = document.getElementById("language-select");
const difficultySelect = document.getElementById("difficulty-select");
const themeToggleBtn  = document.getElementById("theme-toggle-btn");
const ttsToggleBtn    = document.getElementById("tts-toggle-btn");

const modeButtons = {
  conversation: document.getElementById("mode-conversation"),
  grammar:      document.getElementById("mode-grammar"),
  vocabulary:   document.getElementById("mode-vocabulary"),
  roleplay:     document.getElementById("mode-roleplay"),
};
const roleplaySelect = document.getElementById("roleplay-scenario");
const chatSelect     = document.getElementById("chat-select");
const newChatBtn     = document.getElementById("new-chat-btn");
const deleteChatBtn  = document.getElementById("delete-chat-btn");
const renameChatBtn  = document.getElementById("rename-chat-btn");

export let currentChatId = null;
export let currentChat   = null;
export let allChats      = [];

// Global state
export let autoReadEnabled    = true;
export let conversationHistory = [];

// ─── Chat persistence (appStorage = DB for logged-in, localStorage for guest) ─

async function saveChatSessions() {
  await appStorage.setItem("chatSessions", JSON.stringify(allChats));
}

async function loadChatSessions() {
  const raw = await appStorage.getItem("chatSessions");
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Failed to parse saved chat sessions", err);
    return [];
  }
}

function getChatById(id) {
  return allChats.find((chat) => chat.id === id);
}

function updateChatSelect() {
  if (!chatSelect) return;
  chatSelect.innerHTML = "";
  allChats.forEach((chat) => {
    const option = document.createElement("option");
    option.value = chat.id;
    option.textContent = chat.title || `Chat ${allChats.indexOf(chat) + 1}`;
    if (chat.id === currentChatId) option.selected = true;
    chatSelect.appendChild(option);
  });
  if (currentChatId) chatSelect.value = currentChatId;
}

export async function saveCurrentChat() {
  if (!currentChat) return;

  currentChat.updatedAt   = new Date().toISOString();
  currentChat.language    = languageSelect.value;
  currentChat.difficulty  = difficultySelect.value;
  currentChat.mode        = getCurrentMode();
  currentChat.scenario    = getCurrentScenario();
  currentChat.autoReadEnabled = autoReadEnabled;

  const chatMessages  = [];
  const messageElements = document.querySelectorAll(".message");
  messageElements.forEach((msg) => {
    let sender = "ai";
    if (msg.classList.contains("user"))           sender = "user";
    else if (msg.classList.contains("system-error"))   sender = "system-error";
    else if (msg.classList.contains("system-success")) sender = "system-success";
    chatMessages.push({
      sender,
      text: msg.textContent || msg.innerText || "",
      html: msg.innerHTML,
    });
  });

  currentChat.history = chatMessages;
  await saveChatSessions();
}

export async function loadChatSession(chatId) {
  if (!chatId) return;
  if (currentChatId === chatId && currentChat) return;
  if (currentChat) await saveCurrentChat();

  const nextChat = getChatById(chatId);
  if (!nextChat) return;

  currentChatId = nextChat.id;
  currentChat   = nextChat;
  await appStorage.setItem("currentChatId", currentChatId);
  updateChatSelect();

  const chatWindow = document.getElementById("chat-window");
  if (chatWindow) chatWindow.innerHTML = "";
  conversationHistory.length = 0;

  if (currentChat.language)  languageSelect.value  = currentChat.language;
  if (currentChat.difficulty) difficultySelect.value = currentChat.difficulty;
  if (currentChat.scenario && roleplaySelect)
    roleplaySelect.value = currentChat.scenario;

  setCurrentScenario(currentChat.scenario || "restaurant");
  setMode(currentChat.mode || "conversation", true);

  autoReadEnabled = currentChat.autoReadEnabled !== false;
  ttsToggleBtn.textContent = autoReadEnabled ? "🔊 Auto-Read: ON" : "🔇 Auto-Read: OFF";
  ttsToggleBtn.classList.toggle("tts-off", !autoReadEnabled);
  ttsToggleBtn.classList.toggle("tts-on",  autoReadEnabled);

  if (currentChat.history && currentChat.history.length) {
    loadChatHistory(currentChat.history);
  }
}

async function createNewChat() {
  const randomCode = generateRandomChatCode();
  const chat = {
    id:    `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: `Chat ${randomCode}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history:   [],
    mode:      "conversation",
    language:  "Spanish",
    difficulty: "Beginner",
    scenario:  "restaurant",
    autoReadEnabled: true,
    flashcards: {},
  };
  allChats.push(chat);
  await saveChatSessions();
  updateChatSelect();
  await loadChatSession(chat.id);
}

async function renameCurrentChat() {
  if (!currentChat) return;
  const newTitle = prompt("Enter new chat name:", currentChat.title);
  if (!newTitle || newTitle.trim() === "") return;
  currentChat.title     = newTitle.trim();
  currentChat.updatedAt = new Date().toISOString();
  await saveChatSessions();
  updateChatSelect();
}

function generateRandomChatCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  return (
    letters[Math.floor(Math.random() * letters.length)] +
    letters[Math.floor(Math.random() * letters.length)] +
    numbers[Math.floor(Math.random() * numbers.length)]
  );
}

async function initializeChatSessions() {
  allChats = await loadChatSessions();
  const savedChatId = await appStorage.getItem("currentChatId");

  if (!allChats.length) {
    await createNewChat();
    return;
  }

  currentChatId = savedChatId && getChatById(savedChatId) ? savedChatId : allChats[0].id;
  updateChatSelect();
  await loadChatSession(currentChatId);
}

// ─── Listening practice ───────────────────────────────────────────────────────
const listenBtn = document.getElementById("listen-practice-btn");
if (listenBtn) {
  listenBtn.addEventListener("click", startListeningPractice);
} else {
  console.warn("⚠️ Listening practice button not found");
}

// ─── Roleplay intro ───────────────────────────────────────────────────────────
export async function generateRoleplayIntro(scenario, targetLanguage, difficulty) {
  const scenarioPrompts = {
    restaurant:   "You are a waiter/waitress at a restaurant. Greet the customer and ask how many people are in their party and if they'd like to see a menu. Keep your response to 1-2 sentences and stay in character.",
    airport:      "You are an airline check-in agent. Greet the passenger and ask for their passport and ticket. Keep your response to 1-2 sentences and stay in character.",
    hotel:        "You are a hotel receptionist. Greet the guest and ask if they have a reservation. Keep your response to 1-2 sentences and stay in character.",
    shopping:     "You are a shop assistant. Greet the customer and ask what they're looking for today. Keep your response to 1-2 sentences and stay in character.",
    doctor:       "You are a doctor. Greet the patient and ask what symptoms they're experiencing. Keep your response to 1-2 sentences and stay in character.",
    jobInterview: "You are an interviewer. Greet the candidate and ask them to tell you about their background and experience. Keep your response to 1-2 sentences and stay in character.",
    taxi:         "You are a taxi driver. Ask the passenger where they'd like to go. Keep your response to 1-2 sentences and stay in character.",
    phoneCall:    "You are a customer service representative. Answer the phone and ask how you can help the caller. Keep your response to 1-2 sentences and stay in character.",
  };

  const prompt = scenarioPrompts[scenario] ||
    `You are a character in a ${scenario} roleplay scenario. Introduce yourself and start the conversation naturally. Keep your response to 1-2 sentences.`;

  const chatWindow = document.getElementById("chat-window");
  const typing = document.createElement("div");
  typing.classList.add("typing");
  typing.id = "typing-indicator";
  typing.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  chatWindow.appendChild(typing);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const response = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, targetLanguage, difficulty, mode: "roleplay" }),
    });
    document.getElementById("typing-indicator")?.remove();
    const data = await response.json();
    if (data.reply) {
      addMessage(data.reply, "ai");
      if (autoReadEnabled) {
        const { speak } = await import("./chat.js");
        const langMap = { Spanish: "es-ES", French: "fr-FR", German: "de-DE", Italian: "it-IT", Japanese: "ja-JP", Korean: "ko-KR", "Mandarin Chinese": "zh-CN", English: "en-US" };
        speak(data.reply, langMap[targetLanguage]);
      }
    }
  } catch (error) {
    document.getElementById("typing-indicator")?.remove();
    console.error("Error generating roleplay intro:", error);
    const introMessages = {
      restaurant:   "🍽️ Welcome to our restaurant! How many people are in your party today?",
      airport:      "✈️ Good morning! May I see your passport and ticket please?",
      hotel:        "🏨 Welcome to Hotel Grand! Do you have a reservation with us?",
      shopping:     "🛍️ Hello! Welcome to our store. Can I help you find something specific?",
      doctor:       "🏥 Hello, I'm Dr. Smith. What seems to be the problem today?",
      jobInterview: "💼 Nice to meet you! Tell me a bit about your background and experience.",
      taxi:         "🚕 Where to, please?",
      phoneCall:    "📞 Hello, you've reached Customer Service. How may I help you today?",
    };
    addMessage(introMessages[scenario] || `Let's practice ${scenario}! How can I help you?`, "ai");
  }
}

// ─── Mode switching ───────────────────────────────────────────────────────────
export function setMode(mode, suppressMessage = false) {
  setCurrentMode(mode);

  Object.keys(modeButtons).forEach((key) => {
    const btn = modeButtons[key];
    if (!btn) return;
    if (key === mode) {
      btn.classList.add("active-mode");
      btn.style.background   = "#5b6af0";
      btn.style.color        = "#fff";
      btn.style.borderColor  = "#5b6af0";
    } else {
      btn.classList.remove("active-mode");
      btn.style.background  = "var(--btn-bg, #f0f0f0)";
      btn.style.color       = "var(--btn-text, #333)";
      btn.style.borderColor = "var(--border-color, #ccc)";
    }
  });

  const roleplayContainer = document.querySelector(".roleplay-container");
  if (roleplayContainer) {
    roleplayContainer.style.display = mode === "roleplay" ? "flex" : "none";
  }

  if (!suppressMessage) {
    const modeMessages = {
      conversation: "💬 **Conversation Practice Mode** activated! Let's have a natural conversation. I'll correct you gently and ask follow-up questions.",
      grammar:      "📝 **Grammar Correction Mode** activated! I'll focus on fixing your sentences and explaining grammar rules. Try writing something!",
      vocabulary:   "📚 **Vocabulary Building Mode** activated! I'll teach you new words and phrases. What would you like to learn about?",
      roleplay:     "🎭 **Roleplay Mode** activated! Get ready to practice real-life scenarios!",
    };
    addMessage(modeMessages[mode], "system-success");
  }

  if (mode === "roleplay" && !suppressMessage) {
    const scenario      = getCurrentScenario();
    const targetLanguage = document.getElementById("language-select").value;
    const difficulty    = document.getElementById("difficulty-select").value;
    setTimeout(() => generateRoleplayIntro(scenario, targetLanguage, difficulty), 500);
  }
}

// ─── Load settings ────────────────────────────────────────────────────────────
async function loadAllSettings() {
  const savedTheme = await appStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggleBtn.textContent = "☀️ Light Mode";
  } else {
    document.body.classList.remove("dark");
    themeToggleBtn.textContent = "🌙 Dark Mode";
  }

  if (currentChat) {
    if (currentChat.language)  languageSelect.value  = currentChat.language;
    if (currentChat.difficulty) difficultySelect.value = currentChat.difficulty;
    if (roleplaySelect && currentChat.scenario)
      roleplaySelect.value = currentChat.scenario;
    setCurrentScenario(currentChat.scenario || "restaurant");
    setMode(currentChat.mode || "conversation", true);
    autoReadEnabled = currentChat.autoReadEnabled !== false;
  } else {
    const savedLang = await appStorage.getItem("selectedLanguage");
    if (savedLang) languageSelect.value = savedLang;

    const savedDifficulty = await appStorage.getItem("selectedDifficulty");
    if (savedDifficulty) difficultySelect.value = savedDifficulty;

    const savedMode = await appStorage.getItem("selectedMode");
    setMode(savedMode || "conversation", true);
  }

  const savedTTS = await appStorage.getItem("autoReadEnabled");
  if (savedTTS !== null) autoReadEnabled = savedTTS === "true";

  ttsToggleBtn.textContent = autoReadEnabled ? "🔊 Auto-Read: ON" : "🔇 Auto-Read: OFF";
  ttsToggleBtn.classList.toggle("tts-off", !autoReadEnabled);
  ttsToggleBtn.classList.toggle("tts-on",  autoReadEnabled);
}

// ─── Event listeners ──────────────────────────────────────────────────────────
languageSelect.addEventListener("change",  () => saveCurrentChat());
difficultySelect.addEventListener("change", () => saveCurrentChat());

themeToggleBtn.addEventListener("click", async () => {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  themeToggleBtn.textContent = dark ? "☀️ Light Mode" : "🌙 Dark Mode";
  await appStorage.setItem("theme", dark ? "dark" : "light");
});

ttsToggleBtn.addEventListener("click", async () => {
  autoReadEnabled = !autoReadEnabled;
  await appStorage.setItem("autoReadEnabled", autoReadEnabled ? "true" : "false");
  ttsToggleBtn.textContent = autoReadEnabled ? "🔊 Auto-Read: ON" : "🔇 Auto-Read: OFF";
  ttsToggleBtn.classList.toggle("tts-off", !autoReadEnabled);
  ttsToggleBtn.classList.toggle("tts-on",  autoReadEnabled);
  await saveCurrentChat();
  addMessage(autoReadEnabled ? "🔊 Text-to-Speech active. I'll speak my responses." : "🔇 TTS turned off.", "system-success");
});

if (modeButtons.conversation)
  modeButtons.conversation.addEventListener("click", async () => { setMode("conversation"); await saveCurrentChat(); });
if (modeButtons.grammar)
  modeButtons.grammar.addEventListener("click",      async () => { setMode("grammar");      await saveCurrentChat(); });
if (modeButtons.vocabulary)
  modeButtons.vocabulary.addEventListener("click",   async () => { setMode("vocabulary");   await saveCurrentChat(); });
if (modeButtons.roleplay)
  modeButtons.roleplay.addEventListener("click",     async () => { setMode("roleplay");     await saveCurrentChat(); });

if (roleplaySelect) {
  roleplaySelect.addEventListener("change", async (e) => {
    const newScenario = e.target.value;
    setCurrentScenario(newScenario);
    await saveCurrentChat();
    if (getCurrentMode() === "roleplay") {
      addMessage(`🎭 Scenario changed to: ${newScenario.replace(/([A-Z])/g, " $1").toLowerCase().trim()}`, "system-success");
      await generateRoleplayIntro(newScenario, languageSelect.value, difficultySelect.value);
    }
  });
}

if (chatSelect)
  chatSelect.addEventListener("change", () => loadChatSession(chatSelect.value));

if (newChatBtn)
  newChatBtn.addEventListener("click", () => createNewChat());

if (renameChatBtn)
  renameChatBtn.addEventListener("click", () => renameCurrentChat());

if (deleteChatBtn) {
  deleteChatBtn.addEventListener("click", async () => {
    if (!currentChat) return;
    if (!confirm(`Delete "${currentChat.title}"?`)) return;
    allChats = allChats.filter(c => c.id !== currentChatId);
    await saveChatSessions();
    if (allChats.length) {
      currentChatId = null;
      currentChat   = null;
      await loadChatSession(allChats[0].id);
      updateChatSelect();
    } else {
      await createNewChat();
    }
  });
}

const clearChatBtn = document.getElementById("clear-chat-btn");
if (clearChatBtn) {
  clearChatBtn.addEventListener("click", async () => {
    if (!confirm("Clear all chat history for this chat?")) return;
    const chatWindow = document.getElementById("chat-window");
    chatWindow.innerHTML = "";
    conversationHistory.length = 0;
    if (currentChat) {
      currentChat.history = [];
      await saveCurrentChat();
    }
    addMessage("Chat history cleared! Start a new conversation.", "system-success");
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
await initializeChatSessions();
initChat();
initFlashcards();
await loadAllSettings();

// ─── Guest → Account migration ────────────────────────────────────────────────
document.addEventListener("authchange", async (e) => {
  if (e.detail?.wasGuest && e.detail?.user) {
    try {
      await appStorage.migrateGuestDataToServer();
      console.info("✅ Guest data migrated to account");
      // Reload sessions from server now that data is there
      allChats = await loadChatSessions();
      updateChatSelect();
    } catch (err) {
      console.warn("Migration failed:", err);
    }
  }
});