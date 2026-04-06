const model = require("../services/gemini");

exports.askAI = async (req, res) => {
  try {
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
          parts: [{ text: fullPrompt }]
        }
      ]
    });

    res.json({ reply: result.response.text() });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI request failed" });
  }
};
