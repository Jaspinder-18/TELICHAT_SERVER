import express from 'express';
import {
  uploadFile,
  downloadFile,
  getSharedFiles,
  deleteFile
} from '../controllers/fileController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.post('/upload', upload.single('file'), uploadFile);
router.get('/download/:id', downloadFile);
router.get('/shared', getSharedFiles);
router.delete('/:id', deleteFile);

export default router;
