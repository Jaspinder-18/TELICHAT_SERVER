import Message from '../models/Message.js';
import { io } from '../config/socket.js';

export const startScheduledMessageJob = () => {
  console.log('[SCHEDULER] Starting scheduled posts check job...');
  
  // Check every 10 seconds
  setInterval(async () => {
    try {
      const now = new Date();
      // Find messages scheduled in the past that have scheduledAt value
      const pendingMessages = await Message.find({
        scheduledAt: { $lte: now, $ne: null }
      }).populate('sender', 'firstName lastName username profilePhoto').populate('file');

      if (pendingMessages.length > 0) {
        console.log(`[SCHEDULER] Found ${pendingMessages.length} pending scheduled messages to dispatch.`);
        
        for (const msg of pendingMessages) {
          // Send via socket
          if (io) {
            const room = msg.recipientGroup 
              ? msg.recipientGroup.toString() 
              : msg.recipientChannel 
                ? msg.recipientChannel.toString() 
                : msg.recipientUser.toString();
            
            io.to(room).emit('receive-message', msg);
          }
          
          // Clear scheduledAt so we don't dispatch again
          msg.scheduledAt = null;
          await msg.save();
        }
      }
    } catch (error) {
      console.error('[SCHEDULER] Error processing scheduled messages:', error);
    }
  }, 10000);
};
