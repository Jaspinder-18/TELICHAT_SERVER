import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, default: '', trim: true },
    lastName: { type: String, default: '', trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    mobileNumber: { type: String, default: '', trim: true },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
    department: { type: String, default: 'General', trim: true },
    employeeId: { type: String, default: 'EMP-TEMP', trim: true },
    password: { type: String, required: true },
    profilePhoto: { type: String, default: '' },
    
    // Auth & Status fields
    isVerified: { type: Boolean, default: false },
    otpCode: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    
    status: {
      type: String,
      enum: ['active', 'suspended', 'banned', 'approved'],
      default: 'active',
      lowercase: true,
      set: function(val) {
        if (typeof val === 'string' && val.toLowerCase() === 'approved') {
          return 'active';
        }
        return val;
      }
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'USER', 'ADMIN'],
      default: 'user',
      lowercase: true
    },
    
    // Security failed attempts & lockout
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    
    // Refresh Tokens for sessions
    refreshTokens: [{ type: String }],
    
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  if (!this.firstName && !this.lastName) return this.username;
  return `${this.firstName} ${this.lastName}`.trim();
});

// Document middleware: Hash password before saving if modified
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
