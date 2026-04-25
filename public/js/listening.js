import { addMessage, speak, stripMarkdown } from './chat.js';

const listenBtn = document.getElementById("listen-practice-btn");
const listenResultSpan = document.getElementById("listen-result");

let recognition = null;
let isListeningPracticeActive = false;

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
  if (isListeningPracticeActive) {
    addMessage("⚠️ Listening practice already in progress. Complete it first.", "system-error");
    return;
  }
  
  const targetLanguage = document.getElementById("language-select").value;
  const difficulty = document.getElementById("difficulty-select").value;
  const langCode = langMap[targetLanguage] || "en-US";

  const chatWindow = document.getElementById("chat-window");
  
  // Show typing indicator
  const typing = document.createElement("div");
  typing.classList.add("typing");
  typing.id = "typing-indicator";
  typing.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  chatWindow.appendChild(typing);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  addMessage("🎧 **Listening Practice Started!**", "system-success");
  addMessage("I'll speak a sentence. Listen carefully, then repeat it back.", "system-success");

  try {
    const response = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Generate a short, natural sentence in ${targetLanguage} for listening practice at ${difficulty} level. The sentence should be appropriate for the student to listen to and repeat. Return ONLY the sentence, nothing else. No explanations, no quotes around it.`,
        targetLanguage,
        difficulty,
      }),
    });

    const typingElem = document.getElementById("typing-indicator");
    if (typingElem) typingElem.remove();

    const data = await response.json();
    const sentence = data.reply.trim();
    
    // Remove any quotes if present
    const cleanSentence = sentence.replace(/^["']|["']$/g, '');
    
    addMessage(`🔊 **Listen:** ${cleanSentence}`, "ai");
    
    // Short delay before speaking
    setTimeout(() => {
      // Speak the sentence
      const utter = new SpeechSynthesisUtterance(cleanSentence);
      utter.lang = langCode;
      utter.rate = 0.9; // Slightly slower for better comprehension
      speechSynthesis.speak(utter);
      
      addMessage("🎤 **Now it's your turn!** Speak the sentence you heard. Click the microphone button when ready.", "system-success");
      isListeningPracticeActive = true;
      
      // Show a special prompt in the chat
      addMessage("⬅️ Click the 🎤 microphone button and repeat the sentence.", "system-success");
      
      // Store the target sentence for evaluation
      window.listeningTargetSentence = cleanSentence;
      window.listeningTargetLanguage = targetLanguage;
      window.listeningLangCode = langCode;
      window.listeningPracticeActive = true;
      
    }, 500);
    
  } catch (error) {
    const typingElem = document.getElementById("typing-indicator");
    if (typingElem) typingElem.remove();
    
    console.error("Listening practice error:", error);
    addMessage("⚠️ Failed to generate listening practice sentence. Please try again.", "system-error");
  }
}

// Function to evaluate the user's spoken attempt
export async function evaluateListeningAttempt(attempt, targetSentence, targetLanguage) {
  const chatWindow = document.getElementById("chat-window");
  
  addMessage(`🎤 **Your attempt:** "${attempt}"`, "user");
  
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
        prompt: `You are a ${targetLanguage} language teacher. 
        Original sentence: "${targetSentence}"
        Student's attempt: "${attempt}"
        
        Evaluate the student's attempt. Provide:
        1. A score from 0-100
        2. What they got right
        3. What needs improvement (pronunciation, word order, missing words, extra words)
        4. The correct sentence again
        
        Format your response nicely with emojis. Keep it encouraging but honest.`,
        targetLanguage: targetLanguage,
        mode: "grammar",
      }),
    });
    
    const typingElem = document.getElementById("typing-indicator");
    if (typingElem) typingElem.remove();
    
    const data = await response.json();
    addMessage(data.reply, "ai");
    
    // Optionally speak the feedback
    const { autoReadEnabled } = await import('./main.js');
    if (autoReadEnabled) {
      speak(data.reply, langMap[targetLanguage]);
    }
    
    // Ask if they want to continue
    addMessage("🔄 Ready for another listening practice? Click the 🎧 button again!", "system-success");
    
  } catch (error) {
    const typingElem = document.getElementById("typing-indicator");
    if (typingElem) typingElem.remove();
    
    console.error("Evaluation error:", error);
    addMessage("⚠️ Error evaluating your attempt. The correct sentence was: " + targetSentence, "system-error");
  } finally {
    // Reset listening practice state
    isListeningPracticeActive = false;
    window.listeningPracticeActive = false;
    window.listeningTargetSentence = null;
  }
}

// Listen for microphone button clicks when in listening practice mode
const micBtn = document.getElementById("mic-btn");
if (micBtn) {
  // Store original mic click handler if needed, or enhance it
  micBtn.addEventListener("click", () => {
    if (window.listeningPracticeActive && window.listeningTargetSentence) {
      // We're in listening practice mode
      if (!recognition) {
        addMessage("⚠️ Speech recognition not supported in your browser.", "system-error");
        return;
      }
      
      const targetLanguage = window.listeningTargetLanguage || document.getElementById("language-select").value;
      recognition.lang = langMap[targetLanguage] || "en-US";
      micBtn.classList.add("recording");
      
      recognition.onresult = async function(event) {
        micBtn.classList.remove("recording");
        const attempt = event.results[0][0].transcript;
        await evaluateListeningAttempt(attempt, window.listeningTargetSentence, targetLanguage);
      };
      
      recognition.onerror = function(e) {
        micBtn.classList.remove("recording");
        console.error("Speech recognition error:", e.error);
        addMessage("⚠️ Could not recognize speech. Please try again.", "system-error");
      };
      
      recognition.start();
    } else {
      // Normal chat voice input (handled by chat.js)
      // Dispatch a custom event that chat.js can listen to
      const voiceInputEvent = new CustomEvent('voice-input-triggered');
      micBtn.dispatchEvent(voiceInputEvent);
    }
  });
}

// Start listening practice when button is clicked
if (listenBtn) {
  listenBtn.addEventListener("click", startListeningPractice);
} else {
  console.warn("⚠️ Listening practice button not found in DOM. Make sure there's an element with id='listen-practice-btn'");
}

export { startListeningPractice };