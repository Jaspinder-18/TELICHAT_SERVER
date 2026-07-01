import express from 'express';
import {
  getApprovals,
  createApproval,
  updateApprovalStatus
} from '../controllers/approvalController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getApprovals);
router.post('/', createApproval);
router.put('/:id', updateApprovalStatus);

export default router;
