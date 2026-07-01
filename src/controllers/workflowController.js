import Workflow from '../models/Workflow.js';

export const getWorkflows = async (req, res) => {
  try {
    const workflows = await Workflow.find({ creator: req.user._id })
      .sort({ createdAt: -1 });
    res.status(200).json(workflows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createWorkflow = async (req, res) => {
  try {
    const { name, nodes, edges } = req.body;
    const workflow = new Workflow({
      name,
      creator: req.user._id,
      nodes: nodes || [],
      edges: edges || [],
      isActive: true
    });
    await workflow.save();
    res.status(201).json(workflow);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nodes, edges, isActive } = req.body;

    const workflow = await Workflow.findById(id);
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });

    if (name !== undefined) workflow.name = name;
    if (nodes !== undefined) workflow.nodes = nodes;
    if (edges !== undefined) workflow.edges = edges;
    if (isActive !== undefined) workflow.isActive = isActive;

    await workflow.save();
    res.status(200).json(workflow);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    await Workflow.deleteOne({ _id: id });
    res.status(200).json({ success: true, message: 'Workflow deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
