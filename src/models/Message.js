import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientType: { type: String, enum: ['user', 'group', 'channel'], required: true },
    recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    recipientChannel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' },
    content: { type: String, default: '' },
    type: { type: String, enum: ['text', 'file', 'poll'], default: 'text' },
    file: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    poll: {
      question: { type: String },
      options: [
        {
          text: { type: String, required: true },
          votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
        }
      ],
      isClosed: { type: Boolean, default: false }
    },
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true }
      }
    ],
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    forwardFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Original sender if forwarded
    isEdited: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    isStarredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Array of user IDs who starred this message
    status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent' },
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    editHistory: [
      {
        content: { type: String },
        editedAt: { type: Date, default: Date.now }
      }
    ],
    scheduledAt: { type: Date } // Scheduled messages support
  },
  { timestamps: true }
);

const Message = mongoose.model('Message', messageSchema);
export default Message;
