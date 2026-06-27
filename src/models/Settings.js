import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    theme: { type: String, enum: ['light', 'dark'], default: 'dark' }, // default dark theme for tech/office
    privacy: {
      lastSeen: { type: String, enum: ['everyone', 'nobody'], default: 'everyone' },
      profilePhoto: { type: String, enum: ['everyone', 'nobody'], default: 'everyone' }
    },
    notifications: {
      desktopEnabled: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
      groupInvites: { type: Boolean, default: true }
    },
    language: { type: String, default: 'en' }
  },
  { timestamps: true }
);

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
