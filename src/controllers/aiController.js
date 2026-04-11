const client = require("../services/openrouter");

exports.askAI = async (req, res) => {
  try {
    console.log("Received request:", req.body);

    const { prompt, targetLanguage, difficulty } = req.body;

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
      model: "openai/gpt-oss-120b:free",
      messages: [
        { role: "system", content: "You are a helpful language tutor." },
        { role: "user", content: fullPrompt },
      ],
    });

    const reply = completion.choices[0].message.content;

    console.log("AI reply:", reply);

    res.json({ reply });
  } catch (err) {
    console.error("AI ERROR:", err);
    res.status(500).json({ error: "AI request failed" });
  }
};
