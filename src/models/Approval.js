import mongoose from 'mongoose';

const approvalSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected', 'returned'],
      default: 'pending'
    },
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    signature: { type: String, default: '' }, // Renders standard base64 signature images or text-based hashes
    history: [
      {
        action: { type: String, required: true }, // e.g. 'CREATED', 'APPROVED', 'REJECTED', 'COMMENT_ADDED'
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        timestamp: { type: Date, default: Date.now }
      }
    ],
    associatedFile: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null }
  },
  { timestamps: true }
);

const Approval = mongoose.model('Approval', approvalSchema);
export default Approval;
