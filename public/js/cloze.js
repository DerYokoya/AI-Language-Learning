import { addMessage } from "./chat.js";
import { conversationHistory } from "./main.js";

let currentClozeOverlay = null;

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildConversationContext() {
  if (!conversationHistory || !conversationHistory.length) return "";
  return conversationHistory
    .slice(-30) // keep last 30 turns so the prompt stays lean
    .map((m) => `${m.sender}: ${m.text}`)
    .join("\n");
}

function buildPrompt(targetLanguage, difficulty, context) {
  const contextSection = context
    ? `Here is the recent conversation to draw vocabulary and phrases from:\n"""\n${context}\n"""\nUse words, phrases, and themes from the conversation where possible. If the conversation is too short or off-topic, invent suitable sentences.`
    : `No conversation history is available. Invent suitable sentences about everyday topics.`;

  return `You are a language-learning exercise generator.

Target language: ${targetLanguage}
Learner level: ${difficulty}

CRITICAL RULES:
1. Every sentence, every option, and every hint MUST be entirely in ${targetLanguage}.
2. Do NOT mix any other languages like English, German, French, or Spanish.
3. Use ONLY ${targetLanguage} words and grammar.
4. Output ONLY a valid JSON array - no markdown, no code fences, no extra text.

${contextSection}

Create a CLOZE exercise: write exactly 4 sentences (or short sentence pairs) in ${targetLanguage}. In each sentence, replace ONE key word or short phrase with a blank written as "___". Then provide exactly 3 multiple-choice options for that blank — one correct answer and two plausible distractors. Mix up which option is correct each time.

Return ONLY a JSON array with no extra text, like this:
[
  {
    "sentence": "Yesterday I ___ to the market.",
    "options": ["go", "went", "gone"],
    "answer": "went",
    "hint": "Simple past tense of 'go'"
  }
]

Remember: ALL text including the hint must be in ${targetLanguage}.`;
}

// ── API call ───────────────────────────────────────────────────────────────────

async function fetchClozeExercise(targetLanguage, difficulty) {
  const context = buildConversationContext();
  const prompt = buildPrompt(targetLanguage, difficulty, context);

  const response = await fetch("/api/ai/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      targetLanguage,
      difficulty,
      mode: "cloze",
    }),
  });

  if (response.status === 429) throw new Error("rate_limited");
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const raw = (data.reply || "").trim();

  // Strip markdown code fences if present, then extract the JSON array
  // (handles preamble text like "User Safety: safe" before the array)
  const fenceStripped = raw
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = fenceStripped.indexOf("[");
  const end = fenceStripped.lastIndexOf("]");
  if (start === -1 || end === -1)
    throw new Error("No JSON array found in response");
  const clean = fenceStripped.slice(start, end + 1);
  const items = JSON.parse(clean);

  // Validate each item: answer must be present in options (case-insensitive match)
  return items
    .filter((item) => {
      if (!item.sentence || !Array.isArray(item.options) || !item.answer) return false;
      if (!item.sentence.includes("___")) return false;
      const answerLower = item.answer.trim().toLowerCase();
      const matchedOption = item.options.find(
        (opt) => opt.trim().toLowerCase() === answerLower
      );
      if (!matchedOption) {
        console.warn("Cloze item dropped — answer not in options:", item);
        return false;
      }
      // Normalise answer to exact casing from options array
      item.answer = matchedOption;
      return true;
    })
    .slice(0, 4);
}

// ── Overlay UI ────────────────────────────────────────────────────────────────

function closeOverlay() {
  if (currentClozeOverlay) {
    currentClozeOverlay.remove();
    currentClozeOverlay = null;
  }
}

function renderClozeOverlay(items, targetLanguage, difficulty) {
  closeOverlay();

  const overlay = document.createElement("div");
  overlay.className = "cloze-overlay";
  overlay.innerHTML = `
    <div class="cloze-modal">
      <div class="cloze-header">
        <h2 class="cloze-title">📝 Cloze Story Gaps</h2>
        <button class="cloze-close-btn" title="Close">✕</button>
      </div>
      <p class="cloze-subtitle">${targetLanguage} · ${difficulty} — Fill in the missing word or phrase.</p>
      <div class="cloze-items"></div>
      <div class="cloze-footer">
        <button class="cloze-check-btn">Check Answers</button>
        <button class="cloze-retry-btn">🔄 New Exercise</button>
      </div>
      <div class="cloze-score" style="display:none"></div>
    </div>`;

  const itemsContainer = overlay.querySelector(".cloze-items");

  items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "cloze-item";
    div.dataset.answer = item.answer;
    div.dataset.idx = idx;

    // Render sentence with blank highlighted
    const sentenceHtml = item.sentence.replace(
      "___",
      `<span class="cloze-blank" data-idx="${idx}">___</span>`,
    );

    div.innerHTML = `
      <p class="cloze-sentence">${sentenceHtml}</p>
      <div class="cloze-options">
        ${item.options
          .map(
            (opt) =>
              `<button class="cloze-option" data-value="${opt}">${opt}</button>`,
          )
          .join("")}
      </div>
      ${item.hint ? `<p class="cloze-hint">💡 ${item.hint}</p>` : ""}
      <p class="cloze-feedback" style="display:none"></p>`;

    // Option click — select
    div.querySelectorAll(".cloze-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        div
          .querySelectorAll(".cloze-option")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        // Update the inline blank
        const blankSpan = div.querySelector(`.cloze-blank[data-idx="${idx}"]`);
        if (blankSpan) {
          blankSpan.textContent = btn.dataset.value;
          blankSpan.classList.add("filled");
        }
        // Clear any previous feedback
        div.querySelector(".cloze-feedback").style.display = "none";
        div.classList.remove("correct", "incorrect");
      });
    });

    itemsContainer.appendChild(div);
  });

  // Check answers
  overlay.querySelector(".cloze-check-btn").addEventListener("click", () => {
    let correct = 0;
    overlay.querySelectorAll(".cloze-item").forEach((div) => {
      const selected = div.querySelector(".cloze-option.selected");
      const feedback = div.querySelector(".cloze-feedback");
      if (!selected) {
        feedback.textContent = "⚠️ Please select an answer.";
        feedback.className = "cloze-feedback warn";
        feedback.style.display = "block";
        return;
      }
      const isCorrect =
        selected.dataset.value.trim().toLowerCase() ===
        div.dataset.answer.trim().toLowerCase();
      if (isCorrect) {
        correct++;
        div.classList.add("correct");
        div.classList.remove("incorrect");
        feedback.textContent = "✅ Correct!";
        feedback.className = "cloze-feedback success";
      } else {
        div.classList.add("incorrect");
        div.classList.remove("correct");
        feedback.textContent = `❌ The answer is: ${div.dataset.answer}`;
        feedback.className = "cloze-feedback error";
      }
      feedback.style.display = "block";
    });

    const scoreEl = overlay.querySelector(".cloze-score");
    scoreEl.textContent = `Score: ${correct} / ${items.length}`;
    scoreEl.style.display = "block";
    scoreEl.className =
      correct === items.length
        ? "cloze-score perfect"
        : correct >= items.length / 2
          ? "cloze-score good"
          : "cloze-score low";
  });

  // Retry
  overlay.querySelector(".cloze-retry-btn").addEventListener("click", () => {
    closeOverlay();
    startClozeActivity();
  });

  overlay
    .querySelector(".cloze-close-btn")
    .addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay();
  });

  document.body.appendChild(overlay);
  currentClozeOverlay = overlay;
}

// ── Entry point ────────────────────────────────────────────────────────────────

export async function startClozeActivity() {
  const targetLanguage =
    document.getElementById("language-select")?.value || "Spanish";
  const difficulty =
    document.getElementById("difficulty-select")?.value || "Beginner";

  // Show loading state in chat
  addMessage("📝 Generating cloze exercise…", "system-success");

  try {
    const items = await fetchClozeExercise(targetLanguage, difficulty);
    if (!Array.isArray(items) || !items.length)
      throw new Error("Empty response");
    renderClozeOverlay(items, targetLanguage, difficulty);
  } catch (err) {
    console.error("Cloze error:", err);
    if (err.message === "rate_limited") {
      addMessage("⏱️ Too many requests! Please wait a moment before trying again.", "system-error");
    } else {
      addMessage("⚠️ Could not generate cloze exercise. Please try again.", "system-error");
    }
  }
}