// testGemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Say hello in one word");
    console.log("✅ Gemini reply:", result.response.text());
  } catch (error) {
    console.error("❌ Error testing Gemini:", error);
  }
}

test();
