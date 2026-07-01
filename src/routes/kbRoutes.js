import express from 'express';
import {
  getKBArticles,
  createKBArticle,
  askKnowledgeBase
} from '../controllers/kbController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getKBArticles);
router.post('/', createKBArticle);
router.post('/ask', askKnowledgeBase);

export default router;
