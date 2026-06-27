import mongoose from 'mongoose';

const botSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    token: { type: String, required: true, unique: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    welcomeMessage: { type: String, default: 'Hello! I am a bot. How can I help you today?' },
    autoReplies: [
      {
        trigger: { type: String, required: true, trim: true },
        response: { type: String, required: true, trim: true }
      }
    ],
    isEnabled: { type: Boolean, default: true },
    requestCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const Bot = mongoose.model('Bot', botSchema);
export default Bot;
