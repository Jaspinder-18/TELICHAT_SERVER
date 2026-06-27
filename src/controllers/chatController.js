import Message from '../models/Message.js';
import User from '../models/User.js';
import File from '../models/File.js';
import { io } from '../config/socket.js';
import { handleBotAutoReply } from './botController.js';

// Get contacts (other active users in organization)
export const getContacts = async (req, res) => {
  try {
    const contacts = await User.find({ _id: { $ne: req.user._id }, isVerified: true })
      .select('firstName lastName username email profilePhoto department employeeId isOnline lastSeen')
      .sort({ firstName: 1 });
    res.status(200).json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get one-to-one chat history
export const getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find all messages between req.user._id and userId
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipientUser: userId, recipientType: 'user' },
        { sender: userId, recipientUser: req.user._id, recipientType: 'user' },
      ],
    })
      .populate('sender', 'firstName lastName username profilePhoto')
      .populate('replyTo')
      .populate('forwardFrom', 'firstName lastName username')
      .populate('file')
      .sort({ createdAt: 1 });

    // Mark these messages as read if the recipient is req.user._id
    await Message.updateMany(
      { sender: userId, recipientUser: req.user._id, recipientType: 'user', status: { $ne: 'seen' } },
      { $set: { status: 'seen' }, $addToSet: { seenBy: req.user._id } }
    );

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Send a message (REST API endpoint, triggers socket broadcast)
export const sendMessage = async (req, res) => {
  try {
    const { recipientId, recipientType, content, type, replyToId, fileId, poll } = req.body;

    const messageData = {
      sender: req.user._id,
      recipientType,
      content,
      type: type || 'text',
    };

    if (recipientType === 'user') {
      messageData.recipientUser = recipientId;
    } else if (recipientType === 'group') {
      messageData.recipientGroup = recipientId;
    } else if (recipientType === 'channel') {
      messageData.recipientChannel = recipientId;
    }

    if (replyToId) messageData.replyTo = replyToId;
    if (fileId) messageData.file = fileId;
    if (poll) messageData.poll = poll;

    let message = new Message(messageData);
    await message.save();

    message = await Message.findById(message._id)
      .populate('sender', 'firstName lastName username profilePhoto')
      .populate('replyTo')
      .populate('forwardFrom', 'firstName lastName username')
      .populate('file');

    // Broadcast through socket helper (defined in socket.js)
    if (io) {
      if (recipientType === 'user') {
        io.to(recipientId).to(req.user._id.toString()).emit('receive-message', message);
      } else {
        io.to(recipientId).emit('receive-message', message);
      }
    }

    // Trigger Bot Auto-Replies asynchronously
    handleBotAutoReply(message).catch(err => console.error("Error running bot auto-reply:", err));

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Edit a message
export const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    // Save previous contents in history
    message.editHistory.push({ content: message.content, editedAt: new Date() });
    message.content = content;
    message.isEdited = true;
    await message.save();

    const updatedMessage = await Message.findById(id)
      .populate('sender', 'firstName lastName username profilePhoto')
      .populate('replyTo')
      .populate('forwardFrom', 'firstName lastName username')
      .populate('file');

    // Broadcast edit event
    if (io) {
      const room = message.recipientType === 'user' 
        ? [message.recipientUser.toString(), message.sender.toString()]
        : message.recipientGroup ? message.recipientGroup.toString() : message.recipientChannel.toString();
        
      if (Array.isArray(room)) {
        room.forEach(r => io.to(r).emit('message-edited', updatedMessage));
      } else {
        io.to(room).emit('message-edited', updatedMessage);
      }
    }

    res.status(200).json(updatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a message
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Checking permission: Owner, sender, or moderator/admin of group
    if (message.sender.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await Message.deleteOne({ _id: id });

    // Emit delete event
    if (io) {
      const room = message.recipientType === 'user'
        ? [message.recipientUser.toString(), message.sender.toString()]
        : message.recipientGroup ? message.recipientGroup.toString() : message.recipientChannel.toString();

      if (Array.isArray(room)) {
        room.forEach(r => io.to(r).emit('message-deleted', { messageId: id }));
      } else {
        io.to(room).emit('message-deleted', { messageId: id });
      }
    }

    res.status(200).json({ message: 'Message deleted successfully', messageId: id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// React to a message
export const reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Check if user already reacted with this emoji
    const existingReactionIndex = message.reactions.findIndex(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (existingReactionIndex > -1) {
      if (message.reactions[existingReactionIndex].emoji === emoji) {
        // Remove reaction if clicked same emoji again (toggle off)
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        // Update reaction
        message.reactions[existingReactionIndex].emoji = emoji;
      }
    } else {
      // Add new reaction
      message.reactions.push({ user: req.user._id, emoji });
    }

    await message.save();

    const updatedMessage = await Message.findById(id)
      .populate('sender', 'firstName lastName username profilePhoto')
      .populate('replyTo')
      .populate('forwardFrom', 'firstName lastName username')
      .populate('file');

    // Notify rooms
    if (io) {
      const room = message.recipientType === 'user'
        ? [message.recipientUser.toString(), message.sender.toString()]
        : message.recipientGroup ? message.recipientGroup.toString() : message.recipientChannel.toString();

      if (Array.isArray(room)) {
        room.forEach(r => io.to(r).emit('message-reaction-updated', updatedMessage));
      } else {
        io.to(room).emit('message-reaction-updated', updatedMessage);
      }
    }

    res.status(200).json(updatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Star / Unstar message
export const toggleStarMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const isStarred = message.isStarredBy.includes(req.user._id);

    if (isStarred) {
      message.isStarredBy = message.isStarredBy.filter((userId) => userId.toString() !== req.user._id.toString());
    } else {
      message.isStarredBy.push(req.user._id);
    }

    await message.save();
    res.status(200).json({ message: isStarred ? 'Unstarred message' : 'Starred message', isStarred: !isStarred });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Pin / Unpin message
export const togglePinMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Validate permission (only admins of groups/channels or senders in direct chat)
    if (message.recipientType === 'user') {
      if (message.sender.toString() !== req.user._id.toString() && message.recipientUser.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized to pin this message' });
      }
    }
    // (Additional group/channel authorization checks will be done depending on membership roles)

    message.isPinned = !message.isPinned;
    await message.save();

    // Broadcast pin change
    if (io) {
      const room = message.recipientType === 'user'
        ? [message.recipientUser.toString(), message.sender.toString()]
        : message.recipientGroup ? message.recipientGroup.toString() : message.recipientChannel.toString();

      if (Array.isArray(room)) {
        room.forEach(r => io.to(r).emit('message-pin-toggled', message));
      } else {
        io.to(room).emit('message-pin-toggled', message);
      }
    }

    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Forward a message
export const forwardMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientId, recipientType } = req.body;

    const originalMessage = await Message.findById(id).populate('file');
    if (!originalMessage) return res.status(404).json({ message: 'Message not found' });

    const forwardedMessage = new Message({
      sender: req.user._id,
      recipientType,
      recipientUser: recipientType === 'user' ? recipientId : undefined,
      recipientGroup: recipientType === 'group' ? recipientId : undefined,
      recipientChannel: recipientType === 'channel' ? recipientId : undefined,
      content: originalMessage.content,
      type: originalMessage.type,
      file: originalMessage.file ? originalMessage.file._id : undefined,
      forwardFrom: originalMessage.sender, // Keep reference to original sender
    });

    await forwardedMessage.save();

    const populated = await Message.findById(forwardedMessage._id)
      .populate('sender', 'firstName lastName username profilePhoto')
      .populate('forwardFrom', 'firstName lastName username')
      .populate('file');

    if (io) {
      if (recipientType === 'user') {
        io.to(recipientId).to(req.user._id.toString()).emit('receive-message', populated);
      } else {
        io.to(recipientId).emit('receive-message', populated);
      }
    }

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all starred messages for current user
export const getStarredMessages = async (req, res) => {
  try {
    const starred = await Message.find({ isStarredBy: req.user._id })
      .populate('sender', 'firstName lastName username profilePhoto')
      .populate('file')
      .sort({ createdAt: -1 });
    res.status(200).json(starred);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
