import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Target user for direct chat
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    
    notificationType: {
      type: String,
      required: true,
      enum: [
        'personal_message', 'group_message', 'channel_message', 'reply', 'mention',
        'reaction', 'file_shared', 'image_shared', 'video_shared', 'document_shared',
        'audio_shared', 'voice_note', 'bot_message', 'meeting_reminder', 'event_reminder',
        'birthday_reminder', 'announcement', 'login_alert', 'security_alert', 'task_assignment',
        'task_completed', 'approval_request', 'approval_accepted', 'approval_rejected',
        'join_group', 'leave_group', 'group_created', 'channel_created',
        'incoming_voice_call', 'incoming_video_call', 'missed_call'
      ]
    },
    
    title: { type: String, required: true },
    body: { type: String, required: true },
    icon: { type: String, default: '' },
    image: { type: String, default: '' },
    
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal'
    },
    
    deliveryStatus: {
      type: String,
      enum: ['queued', 'delivered', 'failed'],
      default: 'queued'
    },
    
    readStatus: { type: Boolean, default: false },
    seenStatus: { type: Boolean, default: false },
    clicked: { type: Boolean, default: false },
    
    device: { type: String, default: 'web' },
    deleted: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null } // TTL expiration capability
  },
  { timestamps: true }
);

// Indexes for ultra-fast query performance
notificationSchema.index({ recipient: 1, readStatus: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, seenStatus: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index hook

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
