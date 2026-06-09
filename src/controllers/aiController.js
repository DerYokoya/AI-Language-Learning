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
              content: `You are a JSON generator. Output ONLY a valid JSON array, no prose, no markdown, no explanations.
All sentences, options, and hints must be entirely in ${targetLanguage}. 
Zero mixing of other languages like English, German, French, or Spanish - every word must be ${targetLanguage}.
Each sentence must be grammatically correct ${targetLanguage}.
Keep vocabulary appropriate for ${difficulty} level.` 
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3, // Lower temperature for more consistent JSON output
        });

        const reply = completion.choices[0].message.content;
        return res.json({ reply });
      }

      // Normal tutor mode for conversation, grammar, vocabulary, roleplay
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
      console.error("AI request failed:", err);
      next(new AppError("AI request failed", 503));
    }
  },
};