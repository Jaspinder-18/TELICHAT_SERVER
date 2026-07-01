import Task from '../models/Task.js';
import aiService from '../services/aiService.js';
import User from '../models/User.js';

/**
 * Fetch all tasks
 */
export const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      $or: [{ assignee: req.user._id }, { creator: req.user._id }]
    })
      .populate('assignee', 'firstName lastName username email profilePhoto')
      .populate('creator', 'firstName lastName username email profilePhoto')
      .populate('dependencies')
      .sort({ createdAt: -1 });

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new task
 */
export const createTask = async (req, res) => {
  try {
    const { title, description, priority, dueDate, assigneeId, dependencies, subtasks, approvalRequired } = req.body;

    const task = new Task({
      title,
      description,
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      assignee: assigneeId || null,
      creator: req.user._id,
      dependencies: dependencies || [],
      subtasks: subtasks || [],
      approvalRequired: approvalRequired || false
    });

    await task.save();
    
    const populated = await Task.findById(task._id)
      .populate('assignee', 'firstName lastName username email profilePhoto')
      .populate('creator', 'firstName lastName username email profilePhoto');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update task attributes
 */
export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, dueDate, assigneeId, progress, status, dependencies, subtasks, approvalStatus } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Update fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) task.assignee = assigneeId || null;
    if (progress !== undefined) task.progress = progress;
    if (status !== undefined) task.status = status;
    if (dependencies !== undefined) task.dependencies = dependencies;
    if (subtasks !== undefined) task.subtasks = subtasks;
    if (approvalStatus !== undefined) task.approvalStatus = approvalStatus;

    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignee', 'firstName lastName username email profilePhoto')
      .populate('creator', 'firstName lastName username email profilePhoto')
      .populate('dependencies');

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete task
 */
export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    await Task.deleteOne({ _id: id });
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * AI PM: Overdue risk checker and timeline delays predictor
 */
export const predictTaskDelays = async (req, res) => {
  try {
    // Find all incomplete tasks
    const tasks = await Task.find({ status: { $ne: 'done' } })
      .populate('assignee', 'firstName lastName username')
      .populate('creator', 'firstName lastName username');

    if (tasks.length === 0) {
      return res.status(200).json({
        analysis: "No active incomplete tasks found to evaluate."
      });
    }

    const tasksSummary = tasks.map(t => ({
      title: t.title,
      dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : 'None',
      progress: `${t.progress}%`,
      priority: t.priority,
      assignee: t.assignee ? t.assignee.username : 'Unassigned',
      daysOverdue: t.dueDate && new Date() > t.dueDate 
        ? Math.ceil((new Date() - t.dueDate) / (1000 * 60 * 60 * 24))
        : 0
    }));

    const prompt = `Analyze the following tasks and predict if any are at risk of missing their deadlines. Suggest recovery strategies (e.g. reassigning, adjusting schedules, splitting subtasks). Keep it structured and easy for a manager to digest:\n\n${JSON.stringify(tasksSummary, null, 2)}`;
    
    const analysis = await aiService.generateText(prompt, 'You are an elite project manager auditor.');
    res.status(200).json({ analysis });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
