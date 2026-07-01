import express from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  predictTaskDelays
} from '../controllers/taskController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.get('/predict-delays', predictTaskDelays);

export default router;
