const chatWindow = document.getElementById("chat-window");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const languageSelect = document.getElementById("language-select");
const micBtn = document.getElementById("mic-btn");
const listenBtn = document.getElementById("listen-practice-btn");

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
function speak(text, lang) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
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
  const text = userInput.value.trim();       // read from input
  const targetLanguage = languageSelect.value; // read from select

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
        targetLanguage: targetLanguage,
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

    addMessage(data.reply, "ai");
    speak(data.reply, langMap[targetLanguage]);
  } catch (err) {
    hideTyping();
    addMessage("⚠️ Network error. Check your server.", "ai");
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

  showTyping();
  const response = await fetch("/api/ai/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Give me a short sentence for listening practice.",
      targetLanguage,
    }),
  });
  hideTyping();

  const data = await response.json();
  const sentence = data.reply;

  addMessage(sentence, "ai");

  const langCode = langMap[targetLanguage] || "en-US";
  speak(sentence, langCode);

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
    addMessage(evalData.reply, "ai");
  };
});
