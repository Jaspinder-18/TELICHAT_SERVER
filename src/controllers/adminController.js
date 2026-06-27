import User from '../models/User.js';
import Group from '../models/Group.js';
import Channel from '../models/Channel.js';
import Message from '../models/Message.js';
import File from '../models/File.js';
import Bot from '../models/Bot.js';
import AuditLog from '../models/AuditLog.js';
import { logAudit } from '../utils/logger.js';

// Get admin statistics
export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isVerified: true });
    const onlineUsers = await User.countDocuments({ isOnline: true });
    const totalGroups = await Group.countDocuments();
    const totalChannels = await Channel.countDocuments();
    const totalMessages = await Message.countDocuments();
    const totalFiles = await File.countDocuments({ isDeleted: false });
    
    // Aggregated Bot Usage statistics
    const bots = await Bot.find().select('name username requestCount');
    const totalBotUsage = bots.reduce((sum, b) => sum + (b.requestCount || 0), 0);

    res.status(200).json({
      totalUsers,
      onlineUsers,
      totalGroups,
      totalChannels,
      totalMessages,
      totalFiles,
      totalBotUsage,
      botUsageDetails: bots
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all users (detailed list for admin management)
export const getAllUsersAdmin = async (req, res) => {
  try {
    const users = await User.find()
      .select('firstName lastName username email status role mobileNumber department employeeId createdAt isVerified')
      .sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update user status (Activate/Suspend/Ban)
export const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // 'active', 'suspended', 'banned'

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'admin' && status !== 'active') {
      return res.status(400).json({ message: 'Cannot restrict status of an Admin user' });
    }

    user.status = status;
    await user.save();

    await logAudit({
      user: req.user._id,
      action: `ADMIN_USER_STATUS_${status.toUpperCase()}`,
      req,
      details: { targetUser: user.username },
    });

    res.status(200).json({ message: `User status updated to ${status} successfully`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reset password by Admin
export const adminResetPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = newPassword;
    user.failedAttempts = 0;
    user.lockUntil = null;
    await user.save();

    await logAudit({
      user: req.user._id,
      action: 'ADMIN_USER_PASSWORD_RESET',
      req,
      details: { targetUser: user.username },
    });

    res.status(200).json({ message: `Password reset successfully for ${user.username}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Audit Logs
export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('user', 'username firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(200); // Return last 200 logs
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
