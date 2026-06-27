import express from 'express';
import {
  createBot,
  getMyBots,
  regenerateToken,
  deleteBot,
  validateBotToken,
  botSendMessage,
  botSendFile
} from '../controllers/botController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { botApiLimiter } from '../middlewares/securityMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// User bot management endpoints
router.post('/create', verifyToken, createBot);
router.get('/my', verifyToken, getMyBots);
router.post('/:id/token/regenerate', verifyToken, regenerateToken);
router.delete('/:id', verifyToken, deleteBot);

// External Bot integration API endpoints
router.post('/sendMessage', botApiLimiter, validateBotToken, botSendMessage);
router.post('/sendFile', botApiLimiter, validateBotToken, upload.single('file'), botSendFile);
router.post('/sendImage', botApiLimiter, validateBotToken, upload.single('file'), botSendFile);
router.post('/sendDocument', botApiLimiter, validateBotToken, upload.single('file'), botSendFile);
router.post('/sendNotification', botApiLimiter, validateBotToken, botSendMessage);

export default router;
