import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { io } from '../config/socket.js';
import { sendWebPush, sendAndroidPush } from '../config/push.js';
import { addNotificationJob } from './queueService.js';

/**
 * Checks if the current local time falls within quiet hours
 * @param {string} startStr - Start time (HH:mm)
 * @param {string} endStr - End time (HH:mm)
 * @returns {boolean}
 */
const isWithinQuietHours = (startStr, endStr) => {
  if (!startStr || !endStr) return false;
  try {
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    
    const [sH, sM] = startStr.split(':').map(Number);
    const [eH, eM] = endStr.split(':').map(Number);
    
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;
    
    if (startMin <= endMin) {
      return currentMin >= startMin && currentMin <= endMin;
    } else {
      // Overlapping midnight (e.g. 22:00 to 07:00)
      return currentMin >= startMin || currentMin <= endMin;
    }
  } catch (err) {
    return false;
  }
};

/**
 * Maps notification types to custom alert sounds
 * @param {string} type - Notification Type
 * @returns {string} Sound file name
 */
const getSoundForType = (type) => {
  switch (type) {
    case 'personal_message':
      return 'personal_message.mp3';
    case 'group_message':
      return 'group_message.mp3';
    case 'incoming_voice_call':
    case 'incoming_video_call':
      return 'call.mp3';
    case 'mention':
      return 'mention.mp3';
    case 'bot_message':
      return 'bot.mp3';
    case 'announcement':
      return 'announcement.mp3';
    case 'task_assignment':
    case 'task_completed':
      return 'task.mp3';
    case 'approval_request':
    case 'approval_accepted':
    case 'approval_rejected':
      return 'approval.mp3';
    default:
      return 'default.mp3';
  }
};

/**
 * Saves notification in MongoDB and adds it to the worker queue
 * @param {object} params - Notification attributes
 */
export const createNotification = async (params) => {
  try {
    const expiresAt = params.priority === 'low' 
      ? new Date(Date.now() + 24 * 60 * 60 * 1000) // Low priority expires in 1 day
      : null;

    const notification = new Notification({
      recipient: params.recipient,
      sender: params.sender || null,
      chat: params.chat || null,
      group: params.group || null,
      channel: params.channel || null,
      message: params.message || null,
      notificationType: params.notificationType,
      title: params.title,
      body: params.body,
      icon: params.icon || '',
      image: params.image || '',
      priority: params.priority || 'normal',
      expiresAt
    });

    await notification.save();
    
    // Add job to the queue for asynchronous routing
    await addNotificationJob({
      notificationId: notification._id,
      recipientId: params.recipient,
      title: params.title,
      body: params.body,
      notificationType: params.notificationType,
      priority: params.priority || 'normal'
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Core business engine called by BullMQ/Memory workers to route alerts
 * @param {object} jobData - Notification payload
 */
export const processNotification = async (jobData) => {
  const { notificationId, recipientId, title, body, notificationType, priority } = jobData;
  
  try {
    const user = await User.findById(recipientId);
    if (!user) {
      await Notification.findByIdAndUpdate(notificationId, { deliveryStatus: 'failed' });
      return;
    }

    const settings = user.notificationSettings || { enabled: true, dnd: false };
    const isQuiet = isWithinQuietHours(settings.quietHoursStart, settings.quietHoursEnd);
    
    // Check if muted by DND or quiet hours (bypassed by critical alerts)
    const isMuted = !settings.enabled || settings.dnd || isQuiet;
    const shouldBypass = priority === 'critical';

    if (isMuted && !shouldBypass) {
      console.log(`[Notification Service] Silenced notification for user ${user.username} (DND/Mute active)`);
      await Notification.findByIdAndUpdate(notificationId, { deliveryStatus: 'delivered', seenStatus: true });
      return;
    }

    // Sound payload attachment
    const sound = getSoundForType(notificationType);
    const payload = {
      id: notificationId,
      title,
      body,
      type: notificationType,
      priority,
      sound,
      createdAt: new Date().toISOString()
    };

    let delivered = false;

    // 1. Direct Socket.IO routing
    if (io) {
      const recipientRoom = io.sockets.adapter.rooms.get(recipientId);
      const isOnline = recipientRoom && recipientRoom.size > 0;
      
      if (isOnline) {
        io.to(recipientId).emit('new-notification', payload);
        delivered = true;
        console.log(`[Notification Service] Dispatched socket alert to user ${user.username}`);
      }
    }

    // 2. Off-line / Background push routing (Web Push API)
    if (user.pushSubscriptions && user.pushSubscriptions.length > 0) {
      console.log(`[Notification Service] Routing via Web Push for user ${user.username}...`);
      
      const failedSubs = [];
      for (const sub of user.pushSubscriptions) {
        const result = await sendWebPush(sub, payload);
        if (result.success) {
          delivered = true;
        } else if (result.gone) {
          failedSubs.push(sub.endpoint); // Mark for token cleanup
        }
      }

      // Cleanup dead subscriptions
      if (failedSubs.length > 0) {
        await User.findByIdAndUpdate(recipientId, {
          $pull: { pushSubscriptions: { endpoint: { $in: failedSubs } } }
        });
      }
    }

    // 3. Android FCM Push routing
    if (user.deviceTokens && user.deviceTokens.length > 0) {
      console.log(`[Notification Service] Routing to Android device tokens for ${user.username}...`);
      for (const token of user.deviceTokens) {
        const result = await sendAndroidPush(token, payload);
        if (result.success) {
          delivered = true;
        }
      }
    }

    // Update status in MongoDB
    await Notification.findByIdAndUpdate(notificationId, {
      deliveryStatus: delivered ? 'delivered' : 'failed'
    });

  } catch (error) {
    console.error('Error processing notification:', error);
    await Notification.findByIdAndUpdate(notificationId, { deliveryStatus: 'failed' });
    throw error;
  }
};
