const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use a valid model name for the current SDK
module.exports = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
