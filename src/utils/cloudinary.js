import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary if keys are provided in environment
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Uploads a local file to Cloudinary and deletes the local temporary file.
 * Falls back to returning the local relative path if Cloudinary is not configured.
 * @param {Object} file Multer file object
 * @returns {Promise<string>} Uploaded file URL or local path fallback
 */
export const uploadToCloudinary = async (file) => {
  if (!file) return '';

  if (process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'auto',
        folder: 'enterprise_chat',
      });
      // Delete temporary local file to keep the disk clean
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return result.secure_url;
    } catch (error) {
      console.error('[CLOUDINARY UPLOAD ERROR]', error);
      // Fallback to local path if Cloudinary upload fails
      return `/uploads/${file.filename}`;
    }
  }

  // Fallback for development if Cloudinary is not configured
  return `/uploads/${file.filename}`;
};
