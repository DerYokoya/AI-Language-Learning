// Main application entry point
import { storage } from "./storage.js";
import {
  initChat,
  sendMessage,
  addMessage,
  setCurrentMode,
  getCurrentMode,
  getCurrentScenario,
  setCurrentScenario,
  loadChatHistory,
} from "./chat.js";
import { initFlashcards } from "./flashcards.js";

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
  roleplay: document.getElementById("mode-roleplay"),
};
const roleplaySelect = document.getElementById("roleplay-scenario");

// Global state
export let autoReadEnabled = true;
export let conversationHistory = [];

export async function generateRoleplayIntro(
  scenario,
  targetLanguage,
  difficulty,
) {
  const scenarioPrompts = {
    restaurant:
      "You are a waiter/waitress at a restaurant. Greet the customer and ask how many people are in their party and if they'd like to see a menu. Keep your response to 1-2 sentences and stay in character.",
    airport:
      "You are an airline check-in agent. Greet the passenger and ask for their passport and ticket. Keep your response to 1-2 sentences and stay in character.",
    hotel:
      "You are a hotel receptionist. Greet the guest and ask if they have a reservation. Keep your response to 1-2 sentences and stay in character.",
    shopping:
      "You are a shop assistant. Greet the customer and ask what they're looking for today. Keep your response to 1-2 sentences and stay in character.",
    doctor:
      "You are a doctor. Greet the patient and ask what symptoms they're experiencing. Keep your response to 1-2 sentences and stay in character.",
    jobInterview:
      "You are an interviewer. Greet the candidate and ask them to tell you about their background and experience. Keep your response to 1-2 sentences and stay in character.",
    taxi: "You are a taxi driver. Ask the passenger where they'd like to go. Keep your response to 1-2 sentences and stay in character.",
    phoneCall:
      "You are a customer service representative. Answer the phone and ask how you can help the caller. Keep your response to 1-2 sentences and stay in character.",
  };

  const prompt =
    scenarioPrompts[scenario] ||
    `You are a character in a ${scenario} roleplay scenario. Introduce yourself and start the conversation naturally. Keep your response to 1-2 sentences.`;

  const chatWindow = document.getElementById("chat-window");

  // Show typing indicator
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
      body: JSON.stringify({
        prompt: prompt,
        targetLanguage: targetLanguage,
        difficulty: difficulty,
        mode: "roleplay",
      }),
    });

    // Remove typing indicator
    const typingElem = document.getElementById("typing-indicator");
    if (typingElem) typingElem.remove();

    const data = await response.json();

    if (data.reply) {
      addMessage(data.reply, "ai");
      // Speak the message if auto-read is enabled
      if (autoReadEnabled) {
        const { speak } = await import("./chat.js");
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
        speak(data.reply, langMap[targetLanguage]);
      }
    }
  } catch (error) {
    // Remove typing indicator
    const typingElem = document.getElementById("typing-indicator");
    if (typingElem) typingElem.remove();

    console.error("Error generating roleplay intro:", error);

    // Fallback to static intro messages
    const introMessages = {
      restaurant:
        "🍽️ Welcome to our restaurant! How many people are in your party today?",
      airport: "✈️ Good morning! May I see your passport and ticket please?",
      hotel: "🏨 Welcome to Hotel Grand! Do you have a reservation with us?",
      shopping:
        "🛍️ Hello! Welcome to our store. Can I help you find something specific?",
      doctor: "🏥 Hello, I'm Dr. Smith. What seems to be the problem today?",
      jobInterview:
        "💼 Nice to meet you! Tell me a bit about your background and experience.",
      taxi: "🚕 Where to, please?",
      phoneCall:
        "📞 Hello, you've reached Customer Service. How may I help you today?",
    };
    addMessage(
      introMessages[scenario] ||
        `Let's practice ${scenario}! How can I help you?`,
      "ai",
    );
  }
}

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
  }
  
  // Handle roleplay intro (only when not suppressed and mode is roleplay)
  if (mode === "roleplay" && !suppressMessage) {
    const scenario = getCurrentScenario();
    const targetLanguage = document.getElementById("language-select").value;
    const difficulty = document.getElementById("difficulty-select").value;

    setTimeout(() => {
      generateRoleplayIntro(scenario, targetLanguage, difficulty);
    }, 500);
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
    ttsToggleBtn.textContent = autoReadEnabled
      ? "🔊 Auto-Read: ON"
      : "🔇 Auto-Read: OFF";
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
  roleplaySelect.addEventListener("change", async (e) => {
    const newScenario = e.target.value;
    setCurrentScenario(newScenario);
    
    if (getCurrentMode() === "roleplay") {
      addMessage(`🎭 Scenario changed to: ${newScenario.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`, "system-success");
      
      const targetLanguage = document.getElementById("language-select").value;
      const difficulty = document.getElementById("difficulty-select").value;
      
      await generateRoleplayIntro(newScenario, targetLanguage, difficulty);
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
      addMessage(
        "Chat history cleared! Start a new conversation.",
        "system-success",
      );
    }
  });
}

// Initialize app
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