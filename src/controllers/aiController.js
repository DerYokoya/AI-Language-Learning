const client = require("../services/openrouter");

exports.askAI = async (req, res) => {
  try {
    console.log("Received request:", req.body);

    const { prompt, targetLanguage } = req.body;

    const fullPrompt = `
      System: You are a friendly language-learning tutor.
      Help the user learn ${targetLanguage}.
      Explain clearly, correct mistakes gently, and give examples.

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
