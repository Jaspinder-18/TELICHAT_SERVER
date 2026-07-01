import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    dueDate: { type: Date, default: null },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    progress: { type: Number, default: 0, min: 0, max: 100 }, // 0 to 100
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'review', 'done'],
      default: 'todo'
    },
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    subtasks: [
      {
        title: { type: String, required: true },
        completed: { type: Boolean, default: false }
      }
    ],
    approvalRequired: { type: Boolean, default: false },
    approvalStatus: { type: mongoose.Schema.Types.ObjectId, ref: 'Approval', default: null }
  },
  { timestamps: true }
);

const Task = mongoose.model('Task', taskSchema);
export default Task;
