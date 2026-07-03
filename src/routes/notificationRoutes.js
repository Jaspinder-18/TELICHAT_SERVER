import express from 'express';
import {
  getNotifications,
  getUnreadNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  markAsSeen,
  deleteNotification,
  deleteAllNotifications,
  getVapidPublicKey,
  subscribeWebPush,
  unsubscribeWebPush,
  getSettings,
  updateSettings,
  registerDeviceToken
} from '../controllers/notificationController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/debug-tokens', async (req, res) => {
  try {
    const User = (await import('../models/User.js')).default;
    const users = await User.find({}, 'username email deviceTokens');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apply auth protection to all endpoints
router.use(verifyToken);

// Core notification list queries
router.get('/', getNotifications);
router.get('/unread', getUnreadNotifications);
router.get('/count', getUnreadCount);

// Status updates
router.patch('/read', markAsRead);
router.patch('/read-all', markAllAsRead);
router.patch('/seen', markAsSeen);

// Deletions
router.delete('/all', deleteAllNotifications);
router.delete('/:id', deleteNotification);

// Subscriptions & tokens
router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe', subscribeWebPush);
router.post('/unsubscribe', unsubscribeWebPush);
router.post('/register-device', registerDeviceToken);

// User preferences
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

export default router;
