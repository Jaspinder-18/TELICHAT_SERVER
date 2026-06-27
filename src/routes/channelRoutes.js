import express from 'express';
import {
  createChannel,
  getMyChannels,
  getPublicChannels,
  joinChannel,
  joinChannelByToken,
  postToChannel,
  getChannelPosts,
  addSubscriber,
  removeSubscriber
} from '../controllers/channelController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.post('/', upload.single('avatar'), createChannel);
router.get('/', getMyChannels);
router.get('/public', getPublicChannels);
router.post('/join/:id', joinChannel);
router.post('/join/token/:token', joinChannelByToken);
router.post('/:id/post', postToChannel);
router.get('/:id/posts', getChannelPosts);
router.post('/:id/subscriber', addSubscriber);
router.delete('/:id/subscriber/:userId', removeSubscriber);

export default router;
