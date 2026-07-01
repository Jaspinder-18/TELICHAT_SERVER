import axios from 'axios';

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = 'gemini-2.5-flash'; // High-speed flash model
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  /**
   * Universal fetch helper for Gemini API
   */
  async callGemini(contents, systemInstruction = '') {
    try {
      const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
      
      const payload = {
        contents
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (
        response.data &&
        response.data.candidates &&
        response.data.candidates[0] &&
        response.data.candidates[0].content &&
        response.data.candidates[0].content.parts &&
        response.data.candidates[0].content.parts[0]
      ) {
        return response.data.candidates[0].content.parts[0].text;
      }
      
      throw new Error('Invalid response structure from Gemini API');
    } catch (error) {
      console.error('[GEMINI API ERROR]', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }

  /**
   * Standard text generation
   */
  async generateText(prompt, systemInstruction = '') {
    const contents = [
      {
        parts: [{ text: prompt }]
      }
    ];
    return this.callGemini(contents, systemInstruction);
  }

  /**
   * Real-time text translation
   */
  async translateText(text, targetLang) {
    const system = `You are a professional real-time translator. Translate the text exactly into ${targetLang}. Preserve context and formatting. Output ONLY the translated text, with no extra annotations, conversational remarks, or headers.`;
    return this.generateText(text, system);
  }

  /**
   * Multimodal input: OCR Image to Text
   */
  async ocrImage(imageBuffer, mimeType) {
    const base64Data = imageBuffer.toString('base64');
    const contents = [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: base64Data
            }
          },
          {
            text: 'Perform OCR on this image. Extract all text exactly as written. If it looks like a business card or invoice, extract the structured information. Keep it readable.'
          }
        ]
      }
    ];
    return this.callGemini(contents, 'You are an advanced OCR engine.');
  }

  /**
   * Multimodal input: Audio Transcriber
   */
  async transcribeAudio(audioBuffer, mimeType) {
    const base64Data = audioBuffer.toString('base64');
    const contents = [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/mp3',
              data: base64Data
            }
          },
          {
            text: 'Transcribe this audio recording exactly. If multiple people are speaking, attempt to label speakers if possible (e.g. Speaker 1, Speaker 2).'
          }
        ]
      }
    ];
    return this.callGemini(contents, 'You are an advanced voice transcription bot.');
  }

  /**
   * Conversation Analyst: Detect Tasks / Deadlines / Projects
   */
  async detectWorkflow(messagesText) {
    const system = `You are an automated project management listener. Read the chat log, detect any tasks discussed, and output them in a structured JSON format.
Your output must be a valid JSON array of tasks containing exactly these keys:
- "title": (string) Summary of the task
- "assignee": (string) Name/username of the person assigned or mentioned, or null
- "dueDate": (string) Normalized ISO date format (YYYY-MM-DD) if deadline mentioned, otherwise relative text like "tomorrow"
- "priority": (string) "low", "medium", "high", or "critical"
- "department": (string) Department name or "General"

If no tasks are detected, output an empty array: []
Do not include markdown code block syntax (like \`\`\`json) or any conversational text. Output ONLY the clean JSON string.`;

    const prompt = `Chat log:\n${messagesText}`;
    const resultText = await this.generateText(prompt, system);
    
    try {
      const cleaned = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.warn('Failed to parse Gemini task detection JSON, returning empty:', e.message);
      return [];
    }
  }

  /**
   * Smart Search Query parser
   */
  async parseSearchQuery(query) {
    const system = `Convert a natural language search query into a structured search intent JSON.
Output JSON format:
{
  "searchTerm": "semantic keyword topic",
  "filters": {
    "assignee": "username if searching user tasks",
    "department": "department if mentioned",
    "priority": "priority level if mentioned",
    "fileType": "pdf/word/excel/image if mentioned",
    "type": "task/message/file/group"
  }
}
Output ONLY the valid JSON, no tags, no remarks.`;
    const result = await this.generateText(query, system);
    try {
      const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      return { searchTerm: query, filters: {} };
    }
  }
}

export default new AIService();
