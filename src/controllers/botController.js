import Bot from '../models/Bot.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import File from '../models/File.js';
import Group from '../models/Group.js';
import Channel from '../models/Channel.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../config/socket.js';

// Helper to resolve recipientId to a valid MongoDB ObjectId
const resolveRecipientId = async (recipientId, recipientType) => {
  if (!recipientId) return null;
  
  let cleanRecipientId = recipientId;
  if (typeof cleanRecipientId === 'string') {
    cleanRecipientId = cleanRecipientId.trim();
    
    // Normalize HTML entities sanitized by xss-clean middleware
    cleanRecipientId = cleanRecipientId.replace(/&#x2f;/gi, '/');
    
    // Strip query parameters if present
    if (cleanRecipientId.includes('?')) {
      cleanRecipientId = cleanRecipientId.split('?')[0];
    }
    
    if (cleanRecipientId.includes('/')) {
      const parts = cleanRecipientId.split('/');
      cleanRecipientId = parts[parts.length - 1] || cleanRecipientId;
    }
  }

  const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(cleanRecipientId);
  if (isValidObjectId) {
    return cleanRecipientId;
  }

  if (recipientType === 'group') {
    let group = await Group.findOne({ inviteToken: cleanRecipientId });
    if (!group) {
      group = await Group.findOne({
        name: { $regex: new RegExp('^' + cleanRecipientId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
      });
    }
    return group ? group._id.toString() : null;
  }

  if (recipientType === 'channel') {
    let channel = await Channel.findOne({ inviteToken: cleanRecipientId });
    if (!channel) {
      channel = await Channel.findOne({
        name: { $regex: new RegExp('^' + cleanRecipientId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
      });
    }
    return channel ? channel._id.toString() : null;
  }

  if (recipientType === 'user') {
    let user = await User.findOne({ username: cleanRecipientId.toLowerCase() });
    if (!user) {
      user = await User.findOne({ email: cleanRecipientId.toLowerCase() });
    }
    return user ? user._id.toString() : null;
  }

  return null;
};

// Create bot
export const createBot = async (req, res) => {
  try {
    const { name, username, welcomeMessage, autoReplies } = req.body;
    
    // Check username ends with _bot
    if (!username.endsWith('_bot')) {
      return res.status(400).json({ message: 'Bot username must end with _bot' });
    }

    const existing = await Bot.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Bot with this username already exists' });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this username already exists' });
    }

    // Create User record for bot immediately so it's searchable and can join groups
    const botUser = new User({
      firstName: name,
      lastName: '(Bot)',
      username: username.toLowerCase(),
      email: `${username.toLowerCase()}@officechat.bot`,
      mobileNumber: '0000000000',
      dateOfBirth: new Date(),
      gender: 'other',
      department: 'Automation',
      employeeId: `BOT-${username.toUpperCase()}`,
      password: 'bot-dummy-password',
      isVerified: true,
      isOnline: true
    });
    await botUser.save();

    // Generate bot token
    const token = `bot_${uuidv4().replace(/-/g, '')}`;

    const bot = new Bot({
      name,
      username: username.toLowerCase(),
      token,
      creator: req.user._id,
      welcomeMessage,
      autoReplies: autoReplies || [],
    });

    await bot.save();
    res.status(201).json(bot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user's bots
export const getMyBots = async (req, res) => {
  try {
    const bots = await Bot.find({ creator: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(bots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Regenerate bot token
export const regenerateToken = async (req, res) => {
  try {
    const { id } = req.params;
    const bot = await Bot.findById(id);

    if (!bot) return res.status(404).json({ message: 'Bot not found' });
    if (bot.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    bot.token = `bot_${uuidv4().replace(/-/g, '')}`;
    await bot.save();

    res.status(200).json({ message: 'Token regenerated successfully', token: bot.token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete/Revoke bot
export const deleteBot = async (req, res) => {
  try {
    const { id } = req.params;
    const bot = await Bot.findById(id);

    if (!bot) return res.status(404).json({ message: 'Bot not found' });
    if (bot.creator.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Delete corresponding User stub
    await User.deleteOne({ username: bot.username });

    await Bot.deleteOne({ _id: id });
    res.status(200).json({ message: 'Bot revoked and deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bot Middleware to validate token
export const validateBotToken = async (req, res, next) => {
  try {
    const token = req.headers['x-bot-token'];
    if (!token) return res.status(401).json({ message: 'Bot API Token required in x-bot-token header' });

    const bot = await Bot.findOne({ token, isEnabled: true });
    if (!bot) return res.status(401).json({ message: 'Invalid or disabled Bot API Token' });

    req.bot = bot;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bot API: Send Message
export const botSendMessage = async (req, res) => {
  try {
    const { recipientId, recipientType, content } = req.body;
    const bot = req.bot;

    // Increment request count
    bot.requestCount += 1;
    await bot.save();

    // Resolve targetId from recipientId (could be raw ID, invite link/token, name/username/email)
    const targetId = await resolveRecipientId(recipientId, recipientType);
    if (!targetId) {
      return res.status(444 || 404).json({
        message: `Recipient not found. Checked for valid ID, invite token, name, username, or email matching "${recipientId}" for type "${recipientType}".`
      });
    }

    // System sends bot message
    const botUser = await User.findOne({ username: bot.username });
    if (!botUser) {
      // Create user stub for bot if not exists (so message schema population works)
      const stub = new User({
        firstName: bot.name,
        lastName: '(Bot)',
        username: bot.username,
        email: `${bot.username}@officechat.bot`,
        mobileNumber: '0000000000',
        dateOfBirth: new Date(),
        gender: 'other',
        department: 'Automation',
        employeeId: `BOT-${bot.username.toUpperCase()}`,
        password: 'bot-dummy-password',
        isVerified: true,
        isOnline: true
      });
      await stub.save();
    }

    const senderUser = await User.findOne({ username: bot.username });

    // Validate bot access membership/subscription
    if (recipientType === 'group') {
      const group = await Group.findById(targetId);
      if (!group) return res.status(404).json({ message: 'Group not found' });
      const isMember = group.members.some(m => m.user.toString() === senderUser._id.toString());
      if (!isMember) {
        return res.status(403).json({ message: 'Bot must be added to the group first before sending messages.' });
      }
    } else if (recipientType === 'channel') {
      const channel = await Channel.findById(targetId);
      if (!channel) return res.status(404).json({ message: 'Channel not found' });
      const isSub = channel.subscribers.some(s => s.toString() === senderUser._id.toString());
      if (!isSub) {
        return res.status(403).json({ message: 'Bot must be added to the channel first before sending messages.' });
      }
    } else if (recipientType === 'user') {
      const targetUser = await User.findById(targetId);
      if (!targetUser) return res.status(404).json({ message: 'Recipient user not found' });
    } else {
      return res.status(400).json({ message: 'Invalid recipient type' });
    }

    const message = new Message({
      sender: senderUser._id,
      recipientType,
      recipientUser: recipientType === 'user' ? targetId : undefined,
      recipientGroup: recipientType === 'group' ? targetId : undefined,
      recipientChannel: recipientType === 'channel' ? targetId : undefined,
      content,
      type: 'text',
    });

    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'firstName lastName username profilePhoto');

    if (io) {
      const room = targetId;
      io.to(room).emit('receive-message', populated);
    }

    res.status(200).json({ success: true, message: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bot API: Send File / Image / Document
export const botSendFile = async (req, res) => {
  try {
    const { recipientId, recipientType, fileId, content } = req.body;
    const bot = req.bot;

    bot.requestCount += 1;
    await bot.save();

    // Resolve targetId from recipientId (could be raw ID, invite link/token, name/username/email)
    const targetId = await resolveRecipientId(recipientId, recipientType);
    if (!targetId) {
      return res.status(404).json({
        message: `Recipient not found. Checked for valid ID, invite token, name, username, or email matching "${recipientId}" for type "${recipientType}".`
      });
    }

    const senderUser = await User.findOne({ username: bot.username });

    // Validate bot access membership/subscription
    if (recipientType === 'group') {
      const group = await Group.findById(targetId);
      if (!group) return res.status(404).json({ message: 'Group not found' });
      const isMember = group.members.some(m => m.user.toString() === senderUser._id.toString());
      if (!isMember) {
        return res.status(403).json({ message: 'Bot must be added to the group first before sending files.' });
      }
    } else if (recipientType === 'channel') {
      const channel = await Channel.findById(targetId);
      if (!channel) return res.status(404).json({ message: 'Channel not found' });
      const isSub = channel.subscribers.some(s => s.toString() === senderUser._id.toString());
      if (!isSub) {
        return res.status(403).json({ message: 'Bot must be added to the channel first before sending files.' });
      }
    } else if (recipientType === 'user') {
      const targetUser = await User.findById(targetId);
      if (!targetUser) return res.status(404).json({ message: 'Recipient user not found' });
    } else {
      return res.status(400).json({ message: 'Invalid recipient type' });
    }

    let finalFileId = fileId;

    // Handle physical file upload if provided
    if (req.file) {
      const { originalname, filename, size, mimetype } = req.file;
      const fileUrl = await uploadToCloudinary(req.file);
      const file = new File({
        filename,
        originalname,
        path: fileUrl,
        size,
        mimeType: mimetype,
        uploader: senderUser._id,
      });
      await file.save();
      finalFileId = file._id;
    }

    if (!finalFileId) {
      return res.status(400).json({ message: 'fileId or file upload is required' });
    }

    const fileObj = await File.findById(finalFileId);
    if (!fileObj) return res.status(404).json({ message: 'File not found' });

    const message = new Message({
      sender: senderUser._id,
      recipientType,
      recipientUser: recipientType === 'user' ? targetId : undefined,
      recipientGroup: recipientType === 'group' ? targetId : undefined,
      recipientChannel: recipientType === 'channel' ? targetId : undefined,
      content: content || `Sent a file: ${fileObj.originalname}`,
      type: 'file',
      file: finalFileId,
    });

    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'firstName lastName username profilePhoto')
      .populate('file');

    if (io) {
      const room = targetId;
      io.to(room).emit('receive-message', populated);
    }

    res.status(200).json({ success: true, message: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Auto Reply helper function triggered from Sockets/Messages
export const handleBotAutoReply = async (message) => {
  try {
    if (message.type !== 'text') return; // Only auto-reply to text messages

    // If it's a message in group or user chat
    if (message.recipientType === 'user') {
      const recipientUser = await User.findById(message.recipientUser);
      if (recipientUser && recipientUser.username.endsWith('_bot')) {
        const bot = await Bot.findOne({ username: recipientUser.username, isEnabled: true });
        if (bot) {
          // Increment count
          bot.requestCount += 1;
          await bot.save();

          // Standard reply logic
          let replyContent = bot.welcomeMessage;
          const match = bot.autoReplies.find(
            (r) => message.content.toLowerCase().includes(r.trigger.toLowerCase())
          );
          if (match) {
            replyContent = match.response;
          }

          // Trigger AI Assistant mock response if username contains "ai_bot" or "assistant"
          if (bot.username.includes('ai') || bot.username.includes('assistant')) {
            replyContent = await getAIAssistantResponse(message.content);
          }

          setTimeout(async () => {
            const botUser = await User.findOne({ username: bot.username });
            const botReply = new Message({
              sender: botUser._id,
              recipientType: 'user',
              recipientUser: message.sender._id || message.sender,
              content: replyContent,
              type: 'text',
            });
            await botReply.save();
            const populated = await Message.findById(botReply._id)
              .populate('sender', 'firstName lastName username profilePhoto');
            if (io) {
              const recipientIdStr = (message.sender._id || message.sender).toString();
              io.to(recipientIdStr).emit('receive-message', populated);
            }
          }, 1000);
        }
      }
    } else if (message.recipientType === 'group') {
      const group = await Group.findById(message.recipientGroup).populate('members.user');
      if (group) {
        // Find bots in the group
        const groupBots = group.members.filter(m => m.user && m.user.username && m.user.username.endsWith('_bot'));
        for (const member of groupBots) {
          const botUser = member.user;
          const bot = await Bot.findOne({ username: botUser.username, isEnabled: true });
          if (bot) {
            // Check if bot is mentioned or if a trigger matches
            const isMentioned = message.content.toLowerCase().includes(`@${bot.username}`);
            const match = bot.autoReplies.find(
              (r) => message.content.toLowerCase().includes(r.trigger.toLowerCase())
            );
            
            if (isMentioned || match) {
              bot.requestCount += 1;
              await bot.save();

              let replyContent = bot.welcomeMessage;
              if (match) {
                replyContent = match.response;
              }

              if (bot.username.includes('ai') || bot.username.includes('assistant')) {
                replyContent = await getAIAssistantResponse(message.content);
              }

              setTimeout(async () => {
                const botReply = new Message({
                  sender: botUser._id,
                  recipientType: 'group',
                  recipientGroup: group._id,
                  content: replyContent,
                  type: 'text',
                });
                await botReply.save();
                const populated = await Message.findById(botReply._id)
                  .populate('sender', 'firstName lastName username profilePhoto');
                if (io) {
                  io.to(group._id.toString()).emit('receive-message', populated);
                }
              }, 1000);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to handle bot auto reply:', error);
  }
};

// Simple pattern-based intelligent AI responses
const getAIAssistantResponse = async (userPrompt) => {
  const prompt = userPrompt.toLowerCase();
  if (prompt.includes('hello') || prompt.includes('hi')) {
    return "Hello! I am your AI Assistant. How can I help you today?";
  }
  if (prompt.includes('help')) {
    return "I can answer general questions, draft emails, translate text, write code snippets, or schedule events. What do you need?";
  }
  if (prompt.includes('status') || prompt.includes('project')) {
    return "According to our office records, project sprint tasks are currently 78% complete. Standard deployment is scheduled for Friday.";
  }
  if (prompt.includes('joke')) {
    return "Why don't programmers like nature? It has too many bugs!";
  }
  return `Thank you for your prompt: "${userPrompt}". I have analyzed this request. Let me know if you need specific office documentation or assistance with this!`;
};
