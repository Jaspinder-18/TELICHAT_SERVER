import aiService from '../services/aiService.js';
import Message from '../models/Message.js';
import File from '../models/File.js';

/**
 * Chat with Gemini assistant, context-aware
 */
export const chatWithAssistant = async (req, res) => {
  try {
    const { prompt, chatHistory } = req.body;
    if (!prompt) return res.status(400).json({ message: 'Prompt is required' });

    let fullPrompt = '';
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      // Build conversational history context
      const historyText = chatHistory
        .map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
        .join('\n');
      fullPrompt = `Conversational History:\n${historyText}\n\nUser Question: ${prompt}`;
    } else {
      fullPrompt = prompt;
    }

    const reply = await aiService.generateText(
      fullPrompt,
      'You are a helpful, friendly, and highly capable AI Workspace Assistant. You can answer corporate queries, help with tasks, as well as write creative content, poetry, shayari, or casual chat if asked.'
    );

    res.status(200).json({ reply });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Summarize conversation
 */
export const summarizeConversation = async (req, res) => {
  try {
    const { chatType, chatId, limit = 50 } = req.body;
    if (!chatId || !chatType) return res.status(400).json({ message: 'chatId and chatType are required' });

    // Fetch last messages from database
    const query = {};
    if (chatType === 'user') {
      query.$or = [
        { sender: req.user._id, recipientUser: chatId },
        { sender: chatId, recipientUser: req.user._id }
      ];
    } else if (chatType === 'group') {
      query.recipientGroup = chatId;
    } else if (chatType === 'channel') {
      query.recipientChannel = chatId;
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'firstName lastName username');

    if (messages.length === 0) {
      return res.status(200).json({ summary: 'No messages found to summarize.' });
    }

    // Reverse to chronological order
    const chatText = messages
      .reverse()
      .map(m => `${m.sender.firstName || m.sender.username}: ${m.content}`)
      .join('\n');

    const prompt = `Please summarize the following chat discussion briefly. Outline the key topics discussed, decisions made, and any pending tasks:\n\n${chatText}`;
    const summary = await aiService.generateText(prompt, 'You are an expert meeting recorder and text summarizer.');

    res.status(200).json({ summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Direct Message translation
 */
export const translateMessage = async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ message: 'text and targetLanguage are required' });

    const translation = await aiService.translateText(text, targetLanguage);
    res.status(200).json({ translation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Generate Smart reply suggestions
 */
export const replySuggestions = async (req, res) => {
  try {
    const { messageContent } = req.body;
    if (!messageContent) return res.status(400).json({ message: 'messageContent is required' });

    const prompt = `Read this message: "${messageContent}". Generate exactly 3 short, professional reply suggestions. Return them as a valid JSON array of strings: ["suggestion 1", "suggestion 2", "suggestion 3"]. Do not include code wraps, only output the JSON.`;
    const response = await aiService.generateText(prompt, 'You are a professional assistant.');
    
    let suggestions = [];
    try {
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      suggestions = JSON.parse(cleaned);
    } catch (e) {
      suggestions = ["Noted, thank you.", "I will look into it.", "Acknowledged."];
    }
    
    res.status(200).json({ suggestions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Convert chat thread to email format
 */
export const convertChatToEmail = async (req, res) => {
  try {
    const { chatText, emailType = 'professional update' } = req.body;
    if (!chatText) return res.status(400).json({ message: 'chatText is required' });

    const prompt = `Convert the following chat logs into a highly professional, well-formatted ${emailType} email. Suggest a subject line and write a clear, complete body:\n\n${chatText}`;
    const emailDraft = await aiService.generateText(prompt, 'You are an elite corporate communications draft writer.');

    res.status(200).json({ emailDraft });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Perform OCR on uploaded images
 */
export const performOcr = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Image file upload is required' });

    const textResult = await aiService.ocrImage(req.file.buffer, req.file.mimetype);
    res.status(200).json({ text: textResult });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Transcribe meeting audio recordings
 */
export const transcribeMeetingAudio = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Audio file upload is required' });

    const transcription = await aiService.transcribeAudio(req.file.buffer, req.file.mimetype);
    res.status(200).json({ transcription });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
