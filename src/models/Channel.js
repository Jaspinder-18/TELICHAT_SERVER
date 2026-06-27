import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['public', 'private'], default: 'private' },
    avatar: { type: String, default: '' },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    inviteToken: { type: String, unique: true },
  },
  { timestamps: true }
);

// Virtual for subscriber count
channelSchema.virtual('subscriberCount').get(function () {
  return this.subscribers.length;
});

const Channel = mongoose.model('Channel', channelSchema);
export default Channel;
