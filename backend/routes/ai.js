import express from 'express';
const router = express.Router();
import { authMiddleware } from './auth.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

// ✅ Initialize Gemini
let genAI;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
  console.warn('⚠️ GEMINI_API_KEY is not set. AI routes will be disabled.');
}

router.post('/chat', authMiddleware, async (req, res) => {
  if (!genAI)
    return res.status(503).json({ message: 'AI service is not configured on the server.' });

  if (!req.user.isPremium)
    return res.status(403).json({ message: 'AI consultant is a premium feature.' });

  const { history } = req.body;

  if (!history || !Array.isArray(history) || history.length === 0)
    return res.status(400).json({ message: 'No conversation history provided.' });

  try {
    // Find an optional system instruction from the history
    const systemInstructionMsg = history.find(msg => msg.role === 'system');
    const systemInstruction = systemInstructionMsg ? systemInstructionMsg.content : null;

    const modelParams = { model: "gemini-1.5-flash" };
    if (systemInstruction) {
      modelParams.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const model = genAI.getGenerativeModel(modelParams);

    // Format conversation for Gemini
    const chatHistory = history
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // Ensure conversation starts with a user message.
    // The API requires a user message to start the conversation.
    while (chatHistory.length > 0 && chatHistory[0].role !== 'user') {
      chatHistory.shift();
    }

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const streamResult = await model.generateContentStream({ contents: chatHistory });

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text?.();
      if (chunkText) {
        // Send each chunk as a server-sent event
        res.write(`data: ${JSON.stringify({ reply: chunkText })}\n\n`);
      }
    }

    res.end(); // End the stream
  } catch (error) {
    console.error('❌ Error calling Gemini:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'An error occurred while communicating with the AI consultant.' });
    }
  }
});

export default router;