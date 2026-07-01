import mongoose from 'mongoose';

const productivityMetricSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    messagesSent: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },
    focusTimeMinutes: { type: Number, default: 0 },
    responseTimeMinutes: { type: Number, default: 0 },
    communicationScore: { type: Number, default: 100 }, // 0 to 100
    meetingsAttended: { type: Number, default: 0 },
    filesShared: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Compound index to guarantee one log per user per day
productivityMetricSchema.index({ user: 1, date: 1 }, { unique: true });

const ProductivityMetric = mongoose.model('ProductivityMetric', productivityMetricSchema);
export default ProductivityMetric;
