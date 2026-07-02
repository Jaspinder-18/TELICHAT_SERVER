import express from 'express';
import {
  getContacts,
  getChatHistory,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  toggleStarMessage,
  togglePinMessage,
  forwardMessage,
  getStarredMessages,
  markChatAsSeen
} from '../controllers/chatController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyToken); // All chat operations require valid JWT

router.get('/contacts', getContacts);
router.get('/history/:userId', getChatHistory);
router.post('/message', sendMessage);
router.patch('/seen', markChatAsSeen);
router.put('/message/:id', editMessage);
router.delete('/message/:id', deleteMessage);
router.post('/message/:id/reaction', reactToMessage);
router.post('/message/:id/star', toggleStarMessage);
router.post('/message/:id/pin', togglePinMessage);
router.post('/message/:id/forward', forwardMessage);
router.get('/starred', getStarredMessages);

export default router;
