import ProductivityMetric from '../models/ProductivityMetric.js';
import Task from '../models/Task.js';
import Message from '../models/Message.js';
import aiService from '../services/aiService.js';

/**
 * Fetch or aggregate user productivity statistics
 */
export const getProductivityStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Query metrics from DB or compile them in real-time
    let metrics = await ProductivityMetric.find({ user: userId })
      .sort({ date: -1 })
      .limit(7);

    // If no daily logs exist, compile a default fallback structure in real-time
    if (metrics.length === 0) {
      const messagesCount = await Message.countDocuments({ sender: userId });
      const completedTasks = await Task.countDocuments({ assignee: userId, status: 'done' });
      const activeTasks = await Task.countDocuments({ assignee: userId, status: { $ne: 'done' } });

      const fallbackMetric = new ProductivityMetric({
        user: userId,
        date: new Date(),
        messagesSent: messagesCount,
        tasksCompleted: completedTasks,
        focusTimeMinutes: 120, // default placeholder focus
        responseTimeMinutes: 15,
        communicationScore: 92,
        meetingsAttended: 4,
        filesShared: 3
      });
      await fallbackMetric.save();
      metrics = [fallbackMetric];
    }

    // 2. Feed statistics to Gemini to fetch suggestions
    const statsSummary = metrics.map(m => ({
      date: m.date.toISOString().split('T')[0],
      messagesSent: m.messagesSent,
      tasksCompleted: m.tasksCompleted,
      focusTimeMinutes: m.focusTimeMinutes,
      responseTimeMinutes: m.responseTimeMinutes,
      communicationScore: m.communicationScore,
      meetingsAttended: m.meetingsAttended,
      filesShared: m.filesShared
    }));

    const prompt = `Review my daily office productivity stats for the past week:
${JSON.stringify(statsSummary, null, 2)}

Provide exactly 3 bullet-pointed, actionable, positive suggestions on how I can optimize my focus time, decrease response latency, or structure my work tomorrow. Keep it motivating and concise.`;

    const suggestions = await aiService.generateText(prompt, 'You are an expert workspace coach.');

    res.status(200).json({
      metrics,
      suggestions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Manager dashboard analytics (aggregate across department)
 */
export const getDepartmentStats = async (req, res) => {
  try {
    const { department } = req.query;
    if (!department) return res.status(400).json({ message: 'Department parameter is required' });

    // Aggregate metrics for members in specified department
    const aggregated = await ProductivityMetric.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      { $match: { 'userInfo.department': department } },
      {
        $group: {
          _id: '$userInfo.department',
          avgCommunicationScore: { $avg: '$communicationScore' },
          totalTasksCompleted: { $sum: '$tasksCompleted' },
          totalMessagesSent: { $sum: '$messagesSent' },
          avgResponseTime: { $avg: '$responseTimeMinutes' }
        }
      }
    ]);

    res.status(200).json(aggregated[0] || {
      avgCommunicationScore: 100,
      totalTasksCompleted: 0,
      totalMessagesSent: 0,
      avgResponseTime: 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
