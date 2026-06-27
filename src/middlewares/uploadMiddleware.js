import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = './uploads';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const allowedExtensions = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.csv', '.xml', '.json',
  // VFP & Dev files
  '.prg', '.dbf', '.cdx', '.fpt', '.sql',
  // Apps/Archives
  '.exe', '.apk', '.zip', '.rar', '.7z',
  // Media
  '.mp3', '.mp4', '.avi', '.mkv'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Supported types: JPG, PNG, GIF, WEBP, PDF, DOC(X), XLS(X), PPT(X), EXE, APK, ZIP, RAR, 7ZIP, MP3, MP4, AVI, MKV`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '52428800'), // default 50MB
  },
});

export default upload;
