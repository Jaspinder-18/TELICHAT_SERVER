import Group from '../models/Group.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../config/socket.js';

// Create Group
export const createGroup = async (req, res) => {
  try {
    const { name, description, type, memberIds } = req.body;
    const avatar = req.file ? await uploadToCloudinary(req.file) : '';
    const inviteToken = uuidv4();
    const qrCode = `join-group:${inviteToken}`;

    const members = [{ user: req.user._id, role: 'owner' }];
    
    if (memberIds && Array.isArray(memberIds)) {
      memberIds.forEach(id => {
        if (id !== req.user._id.toString()) {
          members.push({ user: id, role: 'member' });
        }
      });
    }

    const group = new Group({
      name,
      description,
      type: type || 'private',
      avatar,
      owner: req.user._id,
      members,
      inviteToken,
      qrCode,
    });

    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate('members.user', 'firstName lastName username email profilePhoto isOnline')
      .populate('owner', 'firstName lastName username');

    // Notify all members via Socket
    if (io) {
      memberIds.forEach(memberId => {
        io.to(memberId).emit('group-created', populatedGroup);
      });
    }

    res.status(201).json(populatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user's groups (includes joined groups and all public groups)
export const getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({
      $or: [
        { 'members.user': req.user._id },
        { type: 'public' }
      ]
    })
      .populate('members.user', 'firstName lastName username email profilePhoto isOnline')
      .populate('owner', 'firstName lastName username')
      .sort({ updatedAt: -1 });
    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Group Details
export const getGroupDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id)
      .populate('members.user', 'firstName lastName username email profilePhoto isOnline')
      .populate('owner', 'firstName lastName username');
    
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    // Verify requestor is member
    const isMember = group.members.some(m => m.user._id.toString() === req.user._id.toString());
    if (!isMember) {
      if (group.type === 'private') {
        return res.status(403).json({ message: 'Access denied to private group' });
      } else {
        // Automatically join public group
        group.members.push({ user: req.user._id, role: 'member' });
        await group.save();
        
        // Re-populate and return the updated group document
        const updated = await Group.findById(id)
          .populate('members.user', 'firstName lastName username email profilePhoto isOnline')
          .populate('owner', 'firstName lastName username');
        return res.status(200).json(updated);
      }
    }

    res.status(200).json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get group messages
export const getGroupMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Verify membership
    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString());
    if (!isMember && group.type === 'private') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const messages = await Message.find({ recipientGroup: id, recipientType: 'group' })
      .populate('sender', 'firstName lastName username profilePhoto')
      .populate('replyTo')
      .populate('forwardFrom', 'firstName lastName username')
      .populate('file')
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Join group via invite token
export const joinGroupByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const group = await Group.findOne({ inviteToken: token });
    if (!group) return res.status(404).json({ message: 'Invalid invite link' });

    // Check if already member
    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString());
    if (isMember) {
      return res.status(400).json({ message: 'You are already a member of this group', groupId: group._id });
    }

    group.members.push({ user: req.user._id, role: 'member' });
    await group.save();

    const updated = await Group.findById(group._id)
      .populate('members.user', 'firstName lastName username email profilePhoto isOnline')
      .populate('owner', 'firstName lastName username');

    if (io) {
      io.to(group._id.toString()).emit('user-joined-group', {
        group: updated,
        userId: req.user._id,
        userName: `${req.user.firstName} ${req.user.lastName}`
      });
    }

    res.status(200).json({ message: 'Joined group successfully', group: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update group member role (Permissions management)
export const updateMemberRole = async (req, res) => {
  try {
    const { id } = req.params; // Group ID
    const { userId, role } = req.body; // member user ID, new role

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Check if caller is owner or admin
    const callerMember = group.members.find(m => m.user.toString() === req.user._id.toString());
    const isGlobalAdmin = req.user.role === 'admin';
    const isGroupAdminOrOwner = callerMember && (callerMember.role === 'owner' || callerMember.role === 'admin');

    if (!isGlobalAdmin && !isGroupAdminOrOwner) {
      return res.status(403).json({ message: 'Unauthorized to change member roles' });
    }

    // Target member
    const targetMember = group.members.find(m => m.user.toString() === userId);
    if (!targetMember) return res.status(404).json({ message: 'Member not found in group' });

    // Cannot demote/change owner
    if (targetMember.role === 'owner' || role === 'owner') {
      return res.status(400).json({ message: 'Cannot transfer ownership this way' });
    }

    targetMember.role = role;
    await group.save();

    const updated = await Group.findById(id)
      .populate('members.user', 'firstName lastName username email profilePhoto isOnline');

    if (io) {
      io.to(id).emit('group-updated', updated);
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle Announcement Mode
export const toggleAnnouncementMode = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const callerMember = group.members.find(m => m.user.toString() === req.user._id.toString());
    const isGlobalAdmin = req.user.role === 'admin';
    const isGroupAdminOrOwner = callerMember && (callerMember.role === 'owner' || callerMember.role === 'admin');

    if (!isGlobalAdmin && !isGroupAdminOrOwner) {
      return res.status(403).json({ message: 'Unauthorized to change announcement settings' });
    }

    group.announcementMode = !group.announcementMode;
    await group.save();

    if (io) {
      io.to(id).emit('group-updated', group);
    }

    res.status(200).json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a group poll
export const createPoll = async (req, res) => {
  try {
    const { id } = req.params; // Group ID or Channel ID or User ID (though polls are mostly group/channel)
    const { question, options, recipientType } = req.body;

    if (!options || options.length < 2) {
      return res.status(400).json({ message: 'Poll requires at least 2 options' });
    }

    const pollOptions = options.map(opt => ({ text: opt, votes: [] }));

    const message = new Message({
      sender: req.user._id,
      recipientType,
      recipientGroup: recipientType === 'group' ? id : undefined,
      recipientChannel: recipientType === 'channel' ? id : undefined,
      type: 'poll',
      poll: {
        question,
        options: pollOptions,
        isClosed: false
      }
    });

    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'firstName lastName username profilePhoto');

    if (io) {
      io.to(id).emit('receive-message', populated);
    }

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Vote in a poll
export const votePoll = async (req, res) => {
  try {
    const { messageId, optionIndex } = req.body;
    const message = await Message.findById(messageId);

    if (!message || message.type !== 'poll') {
      return res.status(404).json({ message: 'Poll message not found' });
    }

    if (message.poll.isClosed) {
      return res.status(400).json({ message: 'This poll has been closed' });
    }

    // Remove user's previous votes in this poll (single-choice standard)
    message.poll.options.forEach(opt => {
      opt.votes = opt.votes.filter(v => v.toString() !== req.user._id.toString());
    });

    // Add new vote
    message.poll.options[optionIndex].votes.push(req.user._id);
    await message.save();

    const updated = await Message.findById(messageId)
      .populate('sender', 'firstName lastName username profilePhoto');

    if (io) {
      const room = message.recipientGroup ? message.recipientGroup.toString() : message.recipientChannel.toString();
      io.to(room).emit('message-edited', updated);
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get shared files in group (Group Media Gallery)
export const getGroupMedia = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find all file messages in group
    const messages = await Message.find({ recipientGroup: id, type: 'file' })
      .populate('file')
      .populate('sender', 'firstName lastName username');

    const files = messages.map(m => m.file).filter(Boolean);
    res.status(200).json(files);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add Member by Admin/Owner
export const addMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Validate requestor is admin/owner
    const caller = group.members.find(m => m.user.toString() === req.user._id.toString());
    const isGlobalAdmin = req.user.role === 'admin';
    const isGroupAdminOrOwner = caller && (caller.role === 'owner' || caller.role === 'admin');

    if (!isGlobalAdmin && !isGroupAdminOrOwner) {
      return res.status(403).json({ message: 'Only admins or owners can add members' });
    }

    // Check if target is already member
    const alreadyMember = group.members.some(m => m.user.toString() === userId);
    if (alreadyMember) {
      return res.status(400).json({ message: 'User is already a member of this group' });
    }

    group.members.push({ user: userId, role: 'member' });
    await group.save();

    const updated = await Group.findById(id)
      .populate('members.user', 'firstName lastName username email profilePhoto isOnline')
      .populate('owner', 'firstName lastName username');

    if (io) {
      io.to(id).emit('group-updated', updated);
      io.to(userId).emit('group-created', updated); // Notify added user
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove Member by Admin/Owner
export const removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Validate requestor is admin/owner
    const caller = group.members.find(m => m.user.toString() === req.user._id.toString());
    const isGlobalAdmin = req.user.role === 'admin';
    const isGroupAdminOrOwner = caller && (caller.role === 'owner' || caller.role === 'admin');

    if (!isGlobalAdmin && !isGroupAdminOrOwner) {
      return res.status(403).json({ message: 'Only admins or owners can remove members' });
    }

    // Target member check
    const target = group.members.find(m => m.user.toString() === userId);
    if (!target) return res.status(404).json({ message: 'Member not found in group' });

    if (target.role === 'owner') {
      return res.status(400).json({ message: 'Cannot remove the group owner' });
    }

    group.members = group.members.filter(m => m.user.toString() !== userId);
    await group.save();

    const updated = await Group.findById(id)
      .populate('members.user', 'firstName lastName username email profilePhoto isOnline')
      .populate('owner', 'firstName lastName username');

    if (io) {
      io.to(id).emit('group-updated', updated);
      io.to(userId).emit('group-removed', { groupId: id });
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Group Details (Name, Description, Avatar, Type)
export const updateGroupDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type } = req.body;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Verify caller is owner or admin
    const caller = group.members.find(m => m.user.toString() === req.user._id.toString());
    const isGlobalAdmin = req.user.role === 'admin';
    const isGroupAdminOrOwner = caller && (caller.role === 'owner' || caller.role === 'admin');

    if (!isGlobalAdmin && !isGroupAdminOrOwner) {
      return res.status(403).json({ message: 'Only admins or owners can update group details' });
    }

    if (name !== undefined) group.name = name;
    if (description !== undefined) group.description = description;
    if (type !== undefined) group.type = type;

    if (req.file) {
      group.avatar = await uploadToCloudinary(req.file);
    }

    await group.save();

    const populated = await Group.findById(id)
      .populate('members.user', 'firstName lastName username email profilePhoto isOnline')
      .populate('owner', 'firstName lastName username');

    if (io) {
      io.to(id).emit('group-updated', populated);
    }

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
