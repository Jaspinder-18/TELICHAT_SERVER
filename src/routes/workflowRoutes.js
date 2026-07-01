import express from 'express';
import {
  getWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow
} from '../controllers/workflowController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getWorkflows);
router.post('/', createWorkflow);
router.put('/:id', updateWorkflow);
router.delete('/:id', deleteWorkflow);

export default router;
