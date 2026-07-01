import Approval from '../models/Approval.js';

/**
 * Fetch approvals related to user
 */
export const getApprovals = async (req, res) => {
  try {
    const approvals = await Approval.find({
      $or: [{ requester: req.user._id }, { approver: req.user._id }]
    })
      .populate('requester', 'firstName lastName username email profilePhoto')
      .populate('approver', 'firstName lastName username email profilePhoto')
      .populate('associatedFile')
      .sort({ createdAt: -1 });

    res.status(200).json(approvals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new approval request
 */
export const createApproval = async (req, res) => {
  try {
    const { title, description, approverId, fileId } = req.body;

    const approval = new Approval({
      title,
      description,
      requester: req.user._id,
      approver: approverId,
      status: 'pending',
      associatedFile: fileId || null
    });

    approval.history.push({
      action: 'CREATED',
      performedBy: req.user._id
    });

    await approval.save();
    
    const populated = await Approval.findById(approval._id)
      .populate('requester', 'firstName lastName username email profilePhoto')
      .populate('approver', 'firstName lastName username email profilePhoto');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update approval status (Approve, Reject, Return)
 */
export const updateApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comments, signature } = req.body;

    const approval = await Approval.findById(id);
    if (!approval) return res.status(404).json({ message: 'Approval not found' });

    // Status transition authorization
    if (status && status !== approval.status) {
      if (req.user._id.toString() !== approval.approver.toString()) {
        return res.status(403).json({ message: 'Only designated approvers can change approval statuses' });
      }
      approval.status = status;
      approval.history.push({
        action: status.toUpperCase(),
        performedBy: req.user._id
      });
    }

    if (signature !== undefined) {
      approval.signature = signature;
    }

    if (comments) {
      approval.comments.push({
        user: req.user._id,
        text: comments
      });
      approval.history.push({
        action: 'COMMENT_ADDED',
        performedBy: req.user._id
      });
    }

    await approval.save();

    const populated = await Approval.findById(approval._id)
      .populate('requester', 'firstName lastName username email profilePhoto')
      .populate('approver', 'firstName lastName username email profilePhoto')
      .populate('comments.user', 'firstName lastName username profilePhoto');

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
