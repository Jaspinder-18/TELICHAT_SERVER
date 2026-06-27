import express from 'express';
import {
  createGroup,
  getMyGroups,
  getGroupDetails,
  getGroupMessages,
  joinGroupByToken,
  updateMemberRole,
  toggleAnnouncementMode,
  createPoll,
  votePoll,
  getGroupMedia,
  addMember,
  removeMember,
  updateGroupDetails
} from '../controllers/groupController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.post('/', upload.single('avatar'), createGroup);
router.get('/', getMyGroups);
router.get('/:id', getGroupDetails);
router.get('/:id/messages', getGroupMessages);
router.post('/join/:token', joinGroupByToken);
router.put('/:id/member/role', updateMemberRole);
router.put('/:id/announcement', toggleAnnouncementMode);
router.post('/:id/poll', createPoll);
router.post('/poll/vote', votePoll);
router.get('/:id/media', getGroupMedia);
router.post('/:id/member', addMember);
router.delete('/:id/member/:userId', removeMember);
router.put('/:id', upload.single('avatar'), updateGroupDetails);

export default router;
