import { addMessage, speak, stripMarkdown } from './chat.js';

const listenBtn = document.getElementById("listen-practice-btn");
const micBtn = document.getElementById("mic-btn");

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

if ("webkitSpeechRecognition" in window) {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
}

async function startListeningPractice() {
  const targetLanguage = document.getElementById("language-select").value;
  const difficulty = document.getElementById("difficulty-select").value;
  const langCode = langMap[targetLanguage] || "en-US";

  const chatWindow = document.getElementById("chat-window");
  
  // Show typing
  const typing = document.createElement("div");
  typing.classList.add("typing");
  typing.id = "typing-indicator";
  typing.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  chatWindow.appendChild(typing);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  const response = await fetch("/api/ai/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Give me a short sentence for listening practice.",
      targetLanguage,
      difficulty,
    }),
  });

  const typingElem = document.getElementById("typing-indicator");
  if (typingElem) typingElem.remove();

  const data = await response.json();
  const sentence = data.reply;

  addMessage(sentence, "ai");

  // Speak the sentence
  const cleanSentence = stripMarkdown(sentence);
  const utter = new SpeechSynthesisUtterance(cleanSentence);
  utter.lang = langCode;
  speechSynthesis.speak(utter);

  addMessage("Now repeat the sentence aloud.", "ai");

  if (!recognition) {
    addMessage("⚠️ Speech recognition not supported in your browser.", "system-error");
    return;
  }

  recognition.lang = langCode;
  micBtn.classList.add("recording");
  recognition.start();

  recognition.onresult = async function (event) {
    micBtn.classList.remove("recording");
    const attempt = event.results[0][0].transcript;
    addMessage(attempt, "user");

    // Show typing
    const typing = document.createElement("div");
    typing.classList.add("typing");
    typing.id = "typing-indicator";
    typing.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
    chatWindow.appendChild(typing);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    const evalResponse = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Evaluate my pronunciation of this sentence: "${sentence}". My attempt: "${attempt}".`,
        targetLanguage,
      }),
    });

    const typingElem = document.getElementById("typing-indicator");
    if (typingElem) typingElem.remove();

    const evalData = await evalResponse.json();
    addMessage(evalData.reply, "ai");
    speak(evalData.reply, langCode);
  };
}

listenBtn.addEventListener("click", startListeningPractice);