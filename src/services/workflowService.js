import aiService from './aiService.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { createNotification } from './notificationService.js';
import { io } from '../config/socket.js';

class WorkflowService {
  /**
   * Scan message content for work-related instructions asynchronously
   */
  async scanMessageForTasks(message) {
    if (!message || message.type !== 'text' || !message.content.trim()) return;

    try {
      // Analyze text with Gemini project detector
      const detectedTasks = await aiService.detectWorkflow(message.content);
      if (!Array.isArray(detectedTasks) || detectedTasks.length === 0) return;

      for (const taskData of detectedTasks) {
        await this.createAutoTask(taskData, message);
      }
    } catch (error) {
      console.error('[Workflow Task Scanner Error]', error.message);
    }
  }

  /**
   * Helper to create auto task, resolve assignee, and trigger notifications
   */
  async createAutoTask(taskData, message) {
    try {
      const creatorId = message.sender._id || message.sender;
      
      // 1. Resolve Assignee
      let assigneeId = null;
      if (taskData.assignee) {
        const cleanName = taskData.assignee.replace(/^@/, '').trim().toLowerCase();
        
        // Match by username, email, or firstName/lastName combinations
        const potentialAssignee = await User.findOne({
          $or: [
            { username: cleanName },
            { email: cleanName },
            { firstName: { $regex: new RegExp('^' + cleanName + '$', 'i') } }
          ]
        });
        
        if (potentialAssignee) {
          assigneeId = potentialAssignee._id;
        }
      }

      // 2. Parse/Normalize Due Date
      let parsedDueDate = null;
      if (taskData.dueDate) {
        const lowerDate = taskData.dueDate.toLowerCase();
        if (lowerDate.includes('today')) {
          parsedDueDate = new Date();
        } else if (lowerDate.includes('tomorrow')) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          parsedDueDate = tomorrow;
        } else {
          const parsed = Date.parse(taskData.dueDate);
          if (!isNaN(parsed)) {
            parsedDueDate = new Date(parsed);
          }
        }
      }

      // 3. Create and Save Task
      const task = new Task({
        title: taskData.title,
        description: `Automatically created by AI workspace assistant from chat discussion: "${message.content}"`,
        priority: taskData.priority || 'medium',
        dueDate: parsedDueDate,
        assignee: assigneeId,
        creator: creatorId,
        status: 'todo',
        progress: 0
      });

      await task.save();

      // Populate references for socket payload
      const populatedTask = await Task.findById(task._id)
        .populate('assignee', 'firstName lastName username email profilePhoto')
        .populate('creator', 'firstName lastName username email profilePhoto');

      // 4. Emit socket event
      if (io) {
        const targetRoom = message.recipientType === 'group' 
          ? message.recipientGroup.toString() 
          : message.recipientType === 'channel'
          ? message.recipientChannel.toString()
          : creatorId.toString();

        io.to(targetRoom).emit('task-created-auto', populatedTask);
      }

      // 5. Send notifications
      if (assigneeId) {
        await createNotification({
          recipient: assigneeId,
          sender: creatorId,
          notificationType: 'task_assignment',
          title: 'New AI Task Assigned',
          body: `You have been assigned: "${task.title}". Priority: ${task.priority.toUpperCase()}`,
          priority: task.priority === 'critical' ? 'critical' : 'high',
          sound: 'mention.mp3'
        });
      }
    } catch (error) {
      console.error('[Auto-Task Creation Failed]', error.message);
    }
  }
}

export default new WorkflowService();
