import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { initSocket } from './config/socket.js';
import { startScheduledMessageJob } from './utils/scheduler.js';

// Middlewares
import {
  globalLimiter,
  setupCors,
  setupHelmet,
  xssClean
} from './middlewares/securityMiddleware.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import channelRoutes from './routes/channelRoutes.js';
import botRoutes from './routes/botRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import kbRoutes from './routes/kbRoutes.js';
import productivityRoutes from './routes/productivityRoutes.js';

// Initialize env
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Sockets
initSocket(server);

// Start scheduled message queue checks
startScheduledMessageJob();

// Apply security headers and cors
app.use(setupHelmet());
app.use(setupCors());

// Apply global rate limiting
app.use(globalLimiter);

// Parsing body payload
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize parameter injections
app.use(xssClean);

// Static uploads folder
const __dirname = path.resolve();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Wire REST API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/group', groupRoutes);
app.use('/api/channel', channelRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/file', fileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/task', taskRoutes);
app.use('/api/approval', approvalRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/productivity', productivityRoutes);

// Test endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Enterprise Office Chat API server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
