import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalname: { type: String, required: true },
    path: { type: String, required: true }, // Local filepath or relative URL
    size: { type: Number, required: true }, // Size in bytes
    mimeType: { type: String, required: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, default: 1 },
    history: [
      {
        version: { type: Number, required: true },
        filename: { type: String, required: true },
        path: { type: String, required: true },
        size: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    downloadsCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    // AI File Intelligence fields
    aiSummary: { type: String, default: '' },
    aiTags: [{ type: String }],
    isConfidential: { type: Boolean, default: false },
    aiInsights: { type: String, default: '' }
  },
  { timestamps: true }
);

const File = mongoose.model('File', fileSchema);
export default File;
