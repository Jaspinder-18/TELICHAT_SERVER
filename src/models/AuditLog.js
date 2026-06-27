import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Can be null if guest action (e.g. login failed)
    action: { type: String, required: true }, // e.g., 'USER_REGISTER', 'USER_LOGIN', 'USER_LOCKOUT', 'ADMIN_BAN'
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed }, // Arbitrary JSON
  },
  { timestamps: { createdAt: true, updatedAt: false } } // Only track creation time
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
