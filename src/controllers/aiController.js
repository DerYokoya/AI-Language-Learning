const model = require("../services/gemini");

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

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: fullPrompt }],
        },
      ],
    });

    const reply = result.response.text();

    console.log("AI reply:", reply);

    res.json({ reply });

  } catch (err) {
    console.error("AI ERROR:", err);
    res.status(500).json({ error: "AI request failed" });
  }
};
