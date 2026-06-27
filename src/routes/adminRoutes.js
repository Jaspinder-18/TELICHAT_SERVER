import express from 'express';
import {
  getAdminStats,
  getAllUsersAdmin,
  updateUserStatus,
  adminResetPassword,
  getAuditLogs
} from '../controllers/adminController.js';
import { verifyToken, adminOnly } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);
router.use(adminOnly); // Admin only barrier

router.get('/stats', getAdminStats);
router.get('/users', getAllUsersAdmin);
router.put('/user/:userId/status', updateUserStatus);
router.put('/user/:userId/reset-password', adminResetPassword);
router.get('/logs', getAuditLogs);

export default router;
