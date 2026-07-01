import { Server } from 'socket.io';
import User from '../models/User.js';
import { handleBotAutoReply } from '../controllers/botController.js';

export let io;

// Map to track active socket connections by User ID
// Key: userId string, Value: Set of socketIds (to support multiple tabs/devices)
const activeUsers = new Map();

export const initSocket = (server) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000'
  ];

  if (process.env.CLIENT_URL) {
    allowedOrigins.push(process.env.CLIENT_URL.replace(/\/$/, ''));
  }
  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, ''));
    allowedOrigins.push(...origins);
  }

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // User announces presence online
    socket.on('user-online', async (userId) => {
      if (!userId) return;
      socket.userId = userId;

      // Join user to their own private room for direct messaging routing
      socket.join(userId);

      if (!activeUsers.has(userId)) {
        activeUsers.set(userId, new Set());
      }
      activeUsers.get(userId).add(socket.id);

      // Update online status in database
      try {
        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
        // Broadcast user status change
        io.emit('user-status-change', { userId, isOnline: true });

        // Query unread count and emit notifications-sync event
        const Notification = (await import('../models/Notification.js')).default;
        const unreadCount = await Notification.countDocuments({
          recipient: userId,
          readStatus: false,
          deleted: { $ne: true }
        });
        socket.emit('notifications-sync', { unreadCount });
      } catch (error) {
        console.error('Error updating user-online:', error);
      }
    });

    // Client requests to join group/channel rooms
    socket.on('join-room', (roomId) => {
      if (!roomId) return;
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    // Client typing indicator
    socket.on('typing', ({ senderId, recipientId, recipientType }) => {
      socket.to(recipientId).emit('typing', { senderId, recipientId, recipientType });
    });

    socket.on('stop-typing', ({ senderId, recipientId, recipientType }) => {
      socket.to(recipientId).emit('stop-typing', { senderId, recipientId, recipientType });
    });

    // Handle incoming messages direct path if sockets are used for message transport
    socket.on('send-message', async (message) => {
      // Just in case client sends message via socket instead of HTTP POST
      // Trigger bot auto-reply checks
      if (message.recipientType === 'user') {
        handleBotAutoReply(message);
      }
    });

    // Disconnect handling
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      const userId = socket.userId;
      if (!userId) return;

      const userSockets = activeUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          activeUsers.delete(userId);
          // Set user offline in DB
          try {
            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
            io.emit('user-status-change', { userId, isOnline: false, lastSeen: new Date() });
          } catch (error) {
            console.error('Error updating user-offline:', error);
          }
        }
      }
    });
  });

  return io;
};
