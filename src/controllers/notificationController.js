import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { vapidPublicKey } from '../config/push.js';

/**
 * GET /api/notifications
 * Fetch paginated list of notifications with filtering and searching
 */
export const getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { recipient: req.user._id, deleted: { $ne: true } };

    // Search query on title/body
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { body: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Filter by type
    if (req.query.type) {
      query.notificationType = req.query.type;
    }

    // Filter by priority
    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'firstName lastName username profilePhoto');

    res.status(200).json({
      notifications,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/notifications/unread
 * Fetch list of unread notifications
 */
export const getUnreadNotifications = async (req, res) => {
  try {
    const unread = await Notification.find({
      recipient: req.user._id,
      readStatus: false,
      deleted: { $ne: true }
    }).sort({ createdAt: -1 });
    res.status(200).json(unread);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/notifications/count
 * Get count of unread notifications
 */
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      readStatus: false,
      deleted: { $ne: true }
    });
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/notifications/read
 * Mark specific notification IDs as read
 */
export const markAsRead = async (req, res) => {
  try {
    const { ids } = req.body; // Array of IDs
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'Valid notification ids array required' });
    }

    await Notification.updateMany(
      { _id: { $in: ids }, recipient: req.user._id },
      { $set: { readStatus: true, seenStatus: true } }
    );

    res.status(200).json({ message: 'Notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, readStatus: false },
      { $set: { readStatus: true, seenStatus: true } }
    );
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/notifications/seen
 * Mark notifications as seen
 */
export const markAsSeen = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'Valid notification ids array required' });
    }

    await Notification.updateMany(
      { _id: { $in: ids }, recipient: req.user._id },
      { $set: { seenStatus: true } }
    );

    res.status(200).json({ message: 'Notifications marked as seen' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a specific notification (soft delete)
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { $set: { deleted: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE /api/notifications/all
 * Delete all notifications (soft delete)
 */
export const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id },
      { $set: { deleted: true } }
    );
    res.status(200).json({ message: 'All notifications deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/notifications/vapid-public-key
 * Fetch VAPID public key dynamically for frontend registration
 */
export const getVapidPublicKey = async (req, res) => {
  res.status(200).json({ publicKey: vapidPublicKey });
};

/**
 * POST /api/notifications/subscribe
 * Register a client browser Web Push subscription
 */
export const subscribeWebPush = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Invalid push subscription details' });
    }

    const user = await User.findById(req.user._id);
    const exists = user.pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);
    
    if (!exists) {
      user.pushSubscriptions.push(subscription);
      await user.save();
    }

    res.status(200).json({ message: 'Subscribed to web push successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/notifications/unsubscribe
 * Remove a browser Web Push subscription
 */
export const unsubscribeWebPush = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ message: 'Endpoint is required' });

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pushSubscriptions: { endpoint } }
    });

    res.status(200).json({ message: 'Unsubscribed from web push' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/notifications/settings
 * Fetch user notification settings
 */
export const getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationSettings');
    res.status(200).json(user.notificationSettings || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/notifications/settings
 * Update user notification preferences
 */
export const updateSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.notificationSettings = {
      ...user.notificationSettings,
      ...req.body
    };
    await user.save();
    res.status(200).json(user.notificationSettings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/notifications/register-device
 * Register an Android FCM device token
 */
export const registerDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Device token is required' });

    const user = await User.findById(req.user._id);
    if (!user.deviceTokens) {
      user.deviceTokens = [];
    }
    if (!user.deviceTokens.includes(token)) {
      user.deviceTokens.push(token);
      await user.save();
    }

    res.status(200).json({ message: 'Device token registered successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
