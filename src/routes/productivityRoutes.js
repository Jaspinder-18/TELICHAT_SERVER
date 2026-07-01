import express from 'express';
import {
  getProductivityStats,
  getDepartmentStats
} from '../controllers/productivityController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getProductivityStats);
router.get('/department', getDepartmentStats);

export default router;
