import mongoose from 'mongoose';

const knowledgeBaseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ['policies', 'hr', 'training', 'manuals', 'sops', 'contracts', 'guides'],
      required: true
    },
    tags: [{ type: String }],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    file: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null }
  },
  { timestamps: true }
);

// Add text indices to enable rapid keyword search
knowledgeBaseSchema.index({ title: 'text', content: 'text', tags: 'text' });

const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
export default KnowledgeBase;
