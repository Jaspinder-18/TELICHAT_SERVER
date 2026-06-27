import express from 'express';
import {
  register,
  verifyEmail,
  login,
  logout,
  refreshToken,
  forgotPasswordRequest,
  verifyForgotPasswordOTP,
  resetPassword,
  updateProfile
} from '../controllers/authController.js';
import upload from '../middlewares/uploadMiddleware.js';
import { authLimiter } from '../middlewares/securityMiddleware.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', upload.single('profilePhoto'), register);
router.post('/verify-email', verifyEmail);
router.post('/login', authLimiter, login);
router.post('/logout', verifyToken, logout);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPasswordRequest);
router.post('/verify-forgot-password-otp', verifyForgotPasswordOTP);
router.post('/reset-password', resetPassword);
router.put('/profile', verifyToken, upload.single('profilePhoto'), updateProfile);

export default router;
