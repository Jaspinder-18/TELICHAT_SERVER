import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['public', 'private'], default: 'private' },
    avatar: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        role: {
          type: String,
          enum: ['owner', 'admin', 'moderator', 'member'],
          default: 'member',
        },
      },
    ],
    inviteToken: { type: String, unique: true },
    qrCode: { type: String, default: '' },
    announcementMode: { type: Boolean, default: false }, // announcementMode = only admins/mods post
  },
  { timestamps: true }
);

const Group = mongoose.model('Group', groupSchema);
export default Group;
