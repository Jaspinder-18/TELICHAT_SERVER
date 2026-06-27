import AuditLog from '../models/AuditLog.js';

export const logAudit = async ({ user, action, req, details }) => {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') : '';
    const userAgent = req ? (req.headers['user-agent'] || '') : '';

    const log = new AuditLog({
      user,
      action,
      ipAddress,
      userAgent,
      details,
    });
    await log.save();
    console.log(`[AUDIT LOG] ${action} by User: ${user || 'GUEST'}. Details: ${JSON.stringify(details || {})}`);
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};
