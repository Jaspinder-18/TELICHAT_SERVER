import Channel from '../models/Channel.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../config/socket.js';

// Create Channel
export const createChannel = async (req, res) => {
  try {
    const { name, description, type } = req.body;
    const avatar = req.file ? await uploadToCloudinary(req.file) : '';
    const inviteToken = uuidv4();

    const channel = new Channel({
      name,
      description,
      type: type || 'private',
      avatar,
      creator: req.user._id,
      subscribers: [req.user._id], // Creator is first subscriber
      inviteToken,
    });

    await channel.save();

    const populated = await Channel.findById(channel._id)
      .populate('creator', 'firstName lastName username')
      .populate('subscribers', 'firstName lastName username email profilePhoto');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyChannels = async (req, res) => {
  try {
    const channels = await Channel.find({
      $or: [
        { subscribers: req.user._id },
        { type: 'public' }
      ]
    })
      .populate('creator', 'firstName lastName username')
      .populate('subscribers', 'firstName lastName username email profilePhoto')
      .sort({ updatedAt: -1 });

    const channelsWithUnread = await Promise.all(channels.map(async (c) => {
      const count = await Message.countDocuments({
        recipientChannel: c._id,
        sender: { $ne: req.user._id },
        seenBy: { $ne: req.user._id }
      });
      return { ...c.toObject(), unreadCount: count };
    }));

    res.status(200).json(channelsWithUnread);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all public channels (for searching/joining)
export const getPublicChannels = async (req, res) => {
  try {
    const channels = await Channel.find({ type: 'public' })
      .select('name description subscribers avatar creator')
      .populate('creator', 'firstName lastName username');
    res.status(200).json(channels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Join channel
export const joinChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const channel = await Channel.findById(id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    if (channel.subscribers.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are already subscribed to this channel' });
    }

    channel.subscribers.push(req.user._id);
    await channel.save();

    res.status(200).json({ message: 'Subscribed successfully', channel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Join Channel via invite token
export const joinChannelByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const channel = await Channel.findOne({ inviteToken: token });
    if (!channel) return res.status(404).json({ message: 'Invalid invite link' });

    if (channel.subscribers.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already subscribed' });
    }

    channel.subscribers.push(req.user._id);
    await channel.save();

    res.status(200).json({ message: 'Subscribed successfully', channel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Post to channel (only creator can post)
export const postToChannel = async (req, res) => {
  try {
    const { id } = req.params; // Channel ID
    const { content, type, fileId, scheduledAt } = req.body;

    const channel = await Channel.findById(id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    if (channel.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the channel creator can post announcements.' });
    }

    const messageData = {
      sender: req.user._id,
      recipientType: 'channel',
      recipientChannel: id,
      content,
      type: type || 'text',
      file: fileId || undefined,
    };

    if (scheduledAt) {
      messageData.scheduledAt = new Date(scheduledAt);
    }

    const message = new Message(messageData);
    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'firstName lastName username profilePhoto')
      .populate('file');

    // If not scheduled, broadcast immediately
    if (!scheduledAt && io) {
      io.to(id).emit('receive-message', populated);
    }

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get channel posts (retrieve posts whose scheduledAt is empty or in the past)
export const getChannelPosts = async (req, res) => {
  try {
    const { id } = req.params;
    const channel = await Channel.findById(id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    // Automatically subscribe if public and not already subscribed
    if (!channel.subscribers.includes(req.user._id)) {
      if (channel.type === 'private') {
        return res.status(403).json({ message: 'Access denied to private channel' });
      } else {
        channel.subscribers.push(req.user._id);
        await channel.save();
      }
    }

    const posts = await Message.find({
      recipientChannel: id,
      recipientType: 'channel',
      $or: [
        { scheduledAt: { $exists: false } },
        { scheduledAt: null },
        { scheduledAt: { $lte: new Date() } }
      ]
    })
      .populate('sender', 'firstName lastName username profilePhoto')
      .populate('file')
      .sort({ createdAt: 1 });

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add subscriber (creator or admin only)
export const addSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const channel = await Channel.findById(id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    // Verify creator or global admin
    if (channel.creator.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the channel creator can add subscribers' });
    }

    if (channel.subscribers.includes(userId)) {
      return res.status(400).json({ message: 'User is already subscribed to this channel' });
    }

    channel.subscribers.push(userId);
    await channel.save();

    const updated = await Channel.findById(id)
      .populate('creator', 'firstName lastName username')
      .populate('subscribers', 'firstName lastName username email profilePhoto');

    if (io) {
      io.to(userId).emit('channel-created', updated);
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove subscriber (creator or admin only)
export const removeSubscriber = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const channel = await Channel.findById(id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    // Verify creator or global admin
    if (channel.creator.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the channel creator can remove subscribers' });
    }

    // Cannot remove creator
    if (channel.creator.toString() === userId) {
      return res.status(400).json({ message: 'Cannot remove the channel creator' });
    }

    channel.subscribers = channel.subscribers.filter(s => s.toString() !== userId);
    await channel.save();

    const updated = await Channel.findById(id)
      .populate('creator', 'firstName lastName username')
      .populate('subscribers', 'firstName lastName username email profilePhoto');

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
