const client = require("../services/openrouter");
const AppError = require("../utils/AppError");

module.exports = {
  async ask(req, res, next) {
    try {
      const { prompt, targetLanguage, difficulty, mode } = req.body;

      // Special handling for cloze mode - bypass the tutor wrapper entirely
      if (mode === "cloze") {
        const completion = await client.chat.completions.create({
          model: "openrouter/free",
          messages: [
            { 
              role: "system", 
              content: `You are a strict JSON generator for language-learning exercises. Follow these rules exactly:
1. Output ONLY a raw JSON array — no markdown, no code fences, no preamble, no explanation.
2. Every sentence, option, hint, and answer MUST be entirely in ${targetLanguage}. No English or other languages.
3. Each item MUST have: "sentence" (with exactly one "___"), "options" (array of exactly 3 strings), "answer" (string that exactly matches one of the options), "hint" (in ${targetLanguage}).
4. The "answer" value MUST be one of the 3 strings in "options" — identical spelling and case.
5. Sentences must be grammatically correct ${targetLanguage} at ${difficulty} level.
6. Return exactly 4 items in the array.` 
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3, // Lower temperature for more consistent JSON output
        });

        const reply = completion.choices[0].message.content;
        return res.json({ reply });
      }

      // Flashcard mode — also needs clean JSON output, not tutor prose
      if (mode === "flashcard") {
        const completion = await client.chat.completions.create({
          model: "openrouter/free",
          messages: [
            {
              role: "system",
              content: `You are a strict JSON generator for language-learning flashcards. Follow these rules exactly:
1. Output ONLY a raw JSON array — no markdown, no code fences, no preamble, no explanation.
2. Each item must have exactly two keys: "front" (word or phrase in ${targetLanguage}) and "back" (English translation, two newlines, then a short usage example in ${targetLanguage}).
3. Return exactly 6 items.`,
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        });
        const reply = completion.choices[0].message.content;
        return res.json({ reply });
      }

      // Listening mode — must return ONLY the sentence, no extra text
      if (mode === "listening") {
        const completion = await client.chat.completions.create({
          model: "openrouter/free",
          messages: [
            {
              role: "system",
              content: `You generate single sentences in ${targetLanguage} for listening practice. Output ONLY the sentence — no quotes, no labels, no explanations, no punctuation beyond what the sentence itself needs. The sentence must be natural, grammatically correct ${targetLanguage} at ${difficulty} level.`,
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.5,
        });
        const reply = completion.choices[0].message.content;
        return res.json({ reply });
      }
      const fullPrompt = `
        System: You are a multilingual language-learning tutor.
        The user may type in ANY language.
        Detect the language the user is writing in.
        Help the user learn ${targetLanguage}.
        Adjust your explanations to the user's difficulty level: ${difficulty}.

        Difficulty rules:
        - Beginner: Use simple vocabulary, short sentences, slow progression.
        - Intermediate: Use richer vocabulary, moderate complexity, examples.
        - Advanced: Use natural, fluent, native-level expressions and deeper explanations.

        Other rules:
        - Always respond in ${targetLanguage}.
        - ONLY correct the user when they write in ${targetLanguage}.
        - If the user writes in another language, do NOT correct them — just answer normally.
        - If the user switches languages, adapt automatically.

        User: ${prompt}
      `;

      const completion = await client.chat.completions.create({
        model: "openrouter/free",
        messages: [
          { role: "system", content: "You are a helpful language tutor." },
          { role: "user", content: fullPrompt },
        ],
      });

      const reply = completion.choices[0].message.content;
      res.json({ reply });
    } catch (err) {
      if (err.status === 429) {
        return next(new AppError("Rate limit reached. Please wait a moment before trying again.", 429));
      }
      console.error("AI request failed:", err);
      next(new AppError("AI request failed", 503));
    }
  },
};