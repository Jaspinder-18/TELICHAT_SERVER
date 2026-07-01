import KnowledgeBase from '../models/KnowledgeBase.js';
import aiService from '../services/aiService.js';

/**
 * Fetch all KB articles
 */
export const getKBArticles = async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$text = { $search: search };
    }

    const articles = await KnowledgeBase.find(query)
      .populate('uploadedBy', 'firstName lastName username')
      .populate('file')
      .sort({ createdAt: -1 });

    res.status(200).json(articles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Add a KB article
 */
export const createKBArticle = async (req, res) => {
  try {
    const { title, content, category, tags, fileId } = req.body;

    const article = new KnowledgeBase({
      title,
      content,
      category,
      tags: tags || [],
      uploadedBy: req.user._id,
      file: fileId || null
    });

    await article.save();
    res.status(201).json(article);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Ask Knowledge Base AI (RAG)
 */
export const askKnowledgeBase = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ message: 'Question is required' });

    // 1. Search DB for articles matching question keyword text
    const matchedDocs = await KnowledgeBase.find(
      { $text: { $search: question } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(3);

    if (matchedDocs.length === 0) {
      return res.status(200).json({
        answer: "I couldn't find any documents in our knowledge base related to your question. Please make sure the documentation has been uploaded.",
        sources: []
      });
    }

    // 2. Build Context block from matches
    const context = matchedDocs
      .map((doc, idx) => `[Source ${idx + 1}]: Title: ${doc.title}\nContent:\n${doc.content}`)
      .join('\n\n---\n\n');

    // 3. Prompt Gemini with strictly enforced RAG rules
    const prompt = `You are a corporate knowledge base assistant. Answer the employee's question strictly based on the provided company document sources. If the answer cannot be found in the sources, state clearly that the information is not present in the company knowledge base.
Always cite your sources by referencing their Source number (e.g. [Source 1]).

Company Document Sources:
${context}

Employee Question:
${question}`;

    const answer = await aiService.generateText(prompt, 'You are an accurate, strict policy checker helper.');
    
    res.status(200).json({
      answer,
      sources: matchedDocs.map(d => ({ id: d._id, title: d.title, category: d.category }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
