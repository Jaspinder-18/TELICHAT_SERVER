import mongoose from 'mongoose';

const workflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
    nodes: [
      {
        id: { type: String, required: true },
        type: { type: String, required: true }, // e.g. 'trigger', 'action', 'condition'
        data: { type: mongoose.Schema.Types.Mixed }, // Trigger/Action configuration
        position: {
          x: { type: Number, default: 0 },
          y: { type: Number, default: 0 }
        }
      }
    ],
    edges: [
      {
        id: { type: String, required: true },
        source: { type: String, required: true },
        target: { type: String, required: true }
      }
    ]
  },
  { timestamps: true }
);

const Workflow = mongoose.model('Workflow', workflowSchema);
export default Workflow;
