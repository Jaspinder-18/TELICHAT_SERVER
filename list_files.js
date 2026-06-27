import mongoose from 'mongoose';
import connectDB from './src/config/db.js';
import File from './src/models/File.js';
import dotenv from 'dotenv';

dotenv.config();
await connectDB();

const files = await File.find().sort({ createdAt: -1 });
console.log('--- ALL FILES IN DATABASE ---');
files.forEach(f => {
  console.log(`ID: ${f._id}`);
  console.log(`Original Name: ${f.originalname}`);
  console.log(`Filename: ${f.filename}`);
  console.log(`Path: ${f.path}`);
  console.log(`Deleted: ${f.isDeleted}`);
  console.log('-----------------------------');
});
process.exit(0);
