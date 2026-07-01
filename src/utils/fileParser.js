import fs from 'fs';
import path from 'path';
import * as pdfParseModule from 'pdf-parse';
const pdfParse = pdfParseModule.default || pdfParseModule;
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import aiService from '../services/aiService.js';
import File from '../models/File.js';

class FileParser {
  /**
   * Extract raw text from local file path before it gets unlinked
   */
  async extractText(filePath, mimeType) {
    try {
      if (!fs.existsSync(filePath)) return '';

      if (mimeType.includes('pdf')) {
        return await this.parsePdf(filePath);
      } else if (mimeType.includes('officedocument.wordprocessingml') || mimeType.includes('msword')) {
        return await this.parseDocx(filePath);
      } else if (mimeType.includes('officedocument.spreadsheetml') || mimeType.includes('excel')) {
        return await this.parseXlsx(filePath);
      } else if (mimeType.startsWith('image/')) {
        const imageBuffer = fs.readFileSync(filePath);
        return await aiService.ocrImage(imageBuffer, mimeType);
      }
      return '';
    } catch (e) {
      console.error('[Text Extraction Failed]', e.message);
      return '';
    }
  }

  /**
   * Analyze extracted text using Gemini and update File metadata
   */
  async analyzeTextAndSave(fileId, text) {
    if (!text || !text.trim()) return;

    try {
      const analysisPrompt = `Analyze the following file text content:
"${text.substring(0, 4000)}"

Return a valid JSON object matching exactly this structure:
{
  "summary": "1-2 sentence summary of the document",
  "tags": ["tag1", "tag2", "tag3"],
  "isConfidential": true/false,
  "insights": "Any critical metrics, values, or warning notes"
}
Output ONLY the clean JSON, no formatting wrapper tags or markdown code blocks.`;

      const responseText = await aiService.generateText(analysisPrompt, 'You are an advanced office document analyzer.');
      
      let parsed = {
        summary: 'Standard uploaded file.',
        tags: ['upload'],
        isConfidential: false,
        insights: 'No specific actions required.'
      };

      try {
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        console.warn('Failed to parse Gemini file intelligence JSON:', e.message);
      }

      await File.findByIdAndUpdate(fileId, {
        aiSummary: parsed.summary,
        aiTags: parsed.tags,
        isConfidential: parsed.isConfidential,
        aiInsights: parsed.insights
      });
    } catch (error) {
      console.error('[Gemini Document Analysis Failed]', error.message);
    }
  }

  async parsePdf(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text || '';
    } catch (e) {
      return '';
    }
  }

  async parseDocx(filePath) {
    try {
      const data = await mammoth.extractRawText({ path: filePath });
      return data.value || '';
    } catch (e) {
      return '';
    }
  }

  async parseXlsx(filePath) {
    try {
      const workbook = xlsx.readFile(filePath);
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += xlsx.utils.sheet_to_txt(sheet) + '\n';
      });
      return text;
    } catch (e) {
      return '';
    }
  }
}

export default new FileParser();
