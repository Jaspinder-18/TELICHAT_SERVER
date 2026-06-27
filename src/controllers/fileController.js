import File from '../models/File.js';
import Message from '../models/Message.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import path from 'path';
import fs from 'fs';

// Upload File
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { originalname, filename, size, mimetype } = req.file;
    
    // Check if user already uploaded a file with same name to create a new version
    const existingFile = await File.findOne({
      originalname,
      uploader: req.user._id,
      isDeleted: false,
    });

    if (existingFile) {
      // Create new version
      const oldVersion = {
        version: existingFile.version,
        filename: existingFile.filename,
        path: existingFile.path,
        size: existingFile.size,
        uploadedAt: existingFile.updatedAt,
      };

      existingFile.history.push(oldVersion);
      existingFile.version += 1;
      existingFile.filename = filename;
      existingFile.path = await uploadToCloudinary(req.file);
      existingFile.size = size;
      existingFile.mimeType = mimetype;

      await existingFile.save();
      return res.status(200).json(existingFile);
    }

    // Standard upload
    const fileUrl = await uploadToCloudinary(req.file);
    const file = new File({
      filename,
      originalname,
      path: fileUrl,
      size,
      mimeType: mimetype,
      uploader: req.user._id,
    });

    await file.save();
    res.status(201).json(file);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Download File
export const downloadFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await File.findById(id);

    if (!file || file.isDeleted) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Increment downloads count
    file.downloadsCount += 1;
    await file.save();

    if (file.path.startsWith('http')) {
      return res.redirect(file.path);
    }

    const __dirname = path.resolve();
    const filePath = path.join(__dirname, 'uploads', file.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Physical file not found on server' });
    }

    res.download(filePath, file.originalname);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get files shared with user / in organization
export const getSharedFiles = async (req, res) => {
  try {
    const files = await File.find({ isDeleted: false })
      .populate('uploader', 'firstName lastName username')
      .sort({ createdAt: -1 });
    res.status(200).json(files);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete file (soft delete)
export const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await File.findById(id);

    if (!file) return res.status(404).json({ message: 'File not found' });

    if (file.uploader.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to delete this file' });
    }

    file.isDeleted = true;
    await file.save();
    res.status(200).json({ message: 'File deleted successfully', fileId: id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
