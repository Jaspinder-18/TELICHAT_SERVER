import express from 'express';
import multer from 'multer';
import {
  chatWithAssistant,
  summarizeConversation,
  translateMessage,
  replySuggestions,
  convertChatToEmail,
  performOcr,
  transcribeMeetingAudio
} from '../controllers/aiController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();
const uploadMemory = multer({ storage: multer.memoryStorage() });

router.use(verifyToken); // All AI services require valid JWT

router.post('/assistant', chatWithAssistant);
router.post('/summarize', summarizeConversation);
router.post('/translate', translateMessage);
router.post('/reply-suggestions', replySuggestions);
router.post('/generate-email', convertChatToEmail);
router.post('/ocr', uploadMemory.single('file'), performOcr);
router.post('/transcribe', uploadMemory.single('file'), transcribeMeetingAudio);

export default router;
