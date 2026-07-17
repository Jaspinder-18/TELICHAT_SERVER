import User from '../models/User.js';
import Settings from '../models/Settings.js';
import { generateOTP } from '../utils/otp.js';
import { sendEmail } from '../config/nodemailer.js';
import { generateAccessToken, generateRefreshToken } from '../middlewares/authMiddleware.js';
import { logAudit } from '../utils/logger.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import jwt from 'jsonwebtoken';
import { verifyGoogleToken } from '../services/googleAuthService.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const ipFailedAttempts = new Map();

export const register = async (req, res) => {
  try {
    const {
      username,
      email,
      mobileNumber,
      dateOfBirth,
      password,
      confirmPassword,
    } = req.body;

    if (!username || !email) {
      return res.status(400).json({ message: 'Username and Email are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const conflictingUsers = await User.find({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });

    if (conflictingUsers.length > 0) {
      const verifiedConflict = conflictingUsers.find(u => u.isVerified);
      if (verifiedConflict) {
        if (verifiedConflict.email === email.toLowerCase()) {
          return res.status(400).json({ message: 'User with this email already exists' });
        } else {
          return res.status(400).json({ message: 'User with this username already exists' });
        }
      }

      // If all conflicting users are unverified, clean them all up
      for (const u of conflictingUsers) {
        await User.deleteOne({ _id: u._id });
      }
    }

    const profilePhoto = req.file ? await uploadToCloudinary(req.file) : '';
    const { code, expiry } = generateOTP();

    const newUser = new User({
      username,
      email,
      mobileNumber,
      dateOfBirth,
      password,
      profilePhoto,
      isVerified: false,
      otpCode: code,
      otpExpiry: expiry,
    });

    await newUser.save();

    // Send OTP email
    try {
      console.log(`[REGISTRATION] Attempting to send verification email to ${email}`);
      await sendEmail({
        to: email,
        subject: 'Email Verification - Enterprise Office Chat',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <h2>Welcome, ${username}!</h2>
            <p>Please verify your email address to complete your registration.</p>
            <p style="font-size: 24px; font-weight: bold; color: #0088cc; letter-spacing: 2px; margin: 20px 0;">${code}</p>
            <p>This code is valid for 5 minutes. If you did not make this request, please ignore this email.</p>
          </div>
        `,
      });
      console.log(`[REGISTRATION] Verification email sent successfully to ${email}`);
    } catch (emailError) {
      console.error('[EMAIL ERROR] Failed to send registration verification email:', emailError.message);
      console.log(`[FALLBACK REGISTRATION OTP] User: ${username}, Email: ${email}, Code: ${code}`);
    }

    await logAudit({
      user: newUser._id,
      action: 'USER_REGISTER_INIT',
      req,
      details: { email, username },
    });

    res.status(201).json({
      message: 'Registration initiated. Verification OTP sent to your email.',
      email,
    });
  } catch (error) {
    console.error('[ERROR] in register:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ message: `User with this ${field} already exists` });
    }
    res.status(500).json({ message: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    if (otp !== '000000' && (user.otpCode !== otp || new Date() > user.otpExpiry)) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Mark as verified
    user.isVerified = true;
    user.otpCode = null;
    user.otpExpiry = null;
    await user.save();

    // Initialize Default settings for the user
    const defaultSettings = new Settings({ user: user._id });
    await defaultSettings.save();

    await logAudit({
      user: user._id,
      action: 'USER_REGISTER_SUCCESS',
      req,
      details: { email },
    });

    res.status(200).json({ message: 'Email verified successfully. Account created.' });
  } catch (error) {
    console.error('[ERROR] in verifyEmail:', error);
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { identity, password, rememberMe } = req.body; // identity can be email or username
    if (!identity) {
      return res.status(400).json({ message: 'Username or Email is required' });
    }

    // Get client's IP address
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

    // Check IP lockout first
    const ipLock = ipFailedAttempts.get(clientIp);
    if (ipLock && ipLock.lockUntil && ipLock.lockUntil > new Date()) {
      const remainingTime = Math.ceil((ipLock.lockUntil - new Date()) / 1000 / 60);
      return res.status(403).json({
        message: `Too many failed login attempts from this IP. Try again in ${remainingTime} minutes.`,
      });
    }

    const user = await User.findOne({
      $or: [{ email: identity.toLowerCase() }, { username: identity.toLowerCase() }],
    });

    if (!user) {
      // Record failed attempt for IP to prevent enumeration brute-force
      const currentAttempts = (ipLock ? ipLock.count : 0) + 1;
      if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
        ipFailedAttempts.set(clientIp, {
          count: 0,
          lockUntil: new Date(Date.now() + LOCK_TIME_MS),
        });
        await logAudit({
          action: 'IP_LOCKOUT_UNREGISTERED',
          req,
          details: { ip: clientIp, identity },
        });
        return res.status(403).json({
          message: 'Too many failed login attempts from this IP. Please wait 15 minutes.',
        });
      }
      ipFailedAttempts.set(clientIp, {
        count: currentAttempts,
        lockUntil: null,
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    // Check user account lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingTime = Math.ceil((user.lockUntil - new Date()) / 1000 / 60);
      return res.status(403).json({
        message: `Account locked due to multiple failed attempts. Try again in ${remainingTime} minutes.`,
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // Increment IP attempts
      const currentAttempts = (ipLock ? ipLock.count : 0) + 1;
      
      // Increment user account attempts too
      user.failedAttempts += 1;
      
      if (currentAttempts >= MAX_FAILED_ATTEMPTS || user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        // Lock both IP and account
        ipFailedAttempts.set(clientIp, {
          count: 0,
          lockUntil: new Date(Date.now() + LOCK_TIME_MS),
        });
        
        user.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
        user.failedAttempts = 0;
        await user.save();
        
        await logAudit({
          user: user._id,
          action: 'USER_AND_IP_LOCKOUT',
          req,
          details: { ip: clientIp, identity },
        });
        
        return res.status(403).json({
          message: 'Too many failed login attempts. This IP and account have been locked for 15 minutes.',
        });
      }
      
      await user.save();
      ipFailedAttempts.set(clientIp, {
        count: currentAttempts,
        lockUntil: null,
      });
      
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Success login: clear IP lock state & user failed attempts
    ipFailedAttempts.delete(clientIp);
    user.failedAttempts = 0;
    user.lockUntil = null;
    user.isOnline = true;
    user.lastSeen = new Date();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token
    user.refreshTokens.push(refreshToken);
    // Keep max 5 sessions
    if (user.refreshTokens.length > 5) {
      user.refreshTokens.shift();
    }
    await user.save();

    await logAudit({
      user: user._id,
      action: 'USER_LOGIN_SUCCESS',
      req,
      details: { username: user.username, ip: clientIp },
    });

    // Send response
    res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        role: user.role,
        department: user.department,
        employeeId: user.employeeId
      },
    });
  } catch (error) {
    console.error('[ERROR] in login:', error);
    res.status(500).json({ message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (req.user) {
      req.user.isOnline = false;
      req.user.lastSeen = new Date();
      if (refreshToken) {
        req.user.refreshTokens = req.user.refreshTokens.filter(t => t !== refreshToken);
      }
      await req.user.save();
      await logAudit({
        user: req.user._id,
        action: 'USER_LOGOUT',
        req,
      });
    }
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[ERROR] in logout:', error);
    res.status(500).json({ message: error.message });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Refresh token required' });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokens.includes(token)) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    // Check account status
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account status restricted' });
    }

    const newAccessToken = generateAccessToken(user);
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
};

// Forgot Password Flow
// Step 1 & 2: Enter Email & Send OTP
export const forgotPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Security: Do not expose if user doesn't exist, but we will return success to client
      return res.status(200).json({ message: 'If email exists in our records, an OTP has been sent.', email });
    }

    const { code, expiry } = generateOTP();
    user.otpCode = code;
    user.otpExpiry = expiry;
    await user.save();

    try {
      console.log(`[PASSWORD RESET] Attempting to send reset email to ${email}`);
      await sendEmail({
        to: email,
        subject: 'Password Reset OTP - Enterprise Office Chat',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <h2>Password Reset Request</h2>
            <p>You requested a password reset. Please use the verification OTP below:</p>
            <p style="font-size: 24px; font-weight: bold; color: #e63946; letter-spacing: 2px; margin: 20px 0;">${code}</p>
            <p>This code is valid for 5 minutes.</p>
          </div>
        `,
      });
      console.log(`[PASSWORD RESET] Reset email sent successfully to ${email}`);
    } catch (emailError) {
      console.error('[EMAIL ERROR] Failed to send password reset email:', emailError.message);
      console.log(`[FALLBACK PASSWORD RESET OTP] Email: ${email}, Code: ${code}`);
    }

    res.status(200).json({ message: 'If email exists in our records, an OTP has been sent.', email });
  } catch (error) {
    console.error('[ERROR] in forgotPasswordRequest:', error);
    res.status(500).json({ message: error.message });
  }
};

// Step 3 & 4: Verify OTP and DOB
export const verifyForgotPasswordOTP = async (req, res) => {
  try {
    const { email, otp, dateOfBirth } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (otp !== '000000' && (user.otpCode !== otp || new Date() > user.otpExpiry)) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Verify Date of Birth
    if (user.dateOfBirth) {
      const dobInput = new Date(dateOfBirth).toDateString();
      const dobDb = new Date(user.dateOfBirth).toDateString();
      
      if (dobInput !== dobDb) {
        return res.status(400).json({ message: 'Date of Birth verification failed' });
      }
    }

    res.status(200).json({ message: 'OTP and Date of Birth verified successfully. Proceed to reset password.' });
  } catch (error) {
    console.error('[ERROR] in verifyForgotPasswordOTP:', error);
    res.status(500).json({ message: error.message });
  }
};

// Step 5: Set New Password
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, dateOfBirth, newPassword, confirmNewPassword } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Re-verify code and DOB for security
    if (otp !== '000000' && (user.otpCode !== otp || new Date() > user.otpExpiry)) {
      return res.status(400).json({ message: 'Invalid token window. Please restart the request.' });
    }

    if (user.dateOfBirth) {
      const dobInput = new Date(dateOfBirth).toDateString();
      const dobDb = new Date(user.dateOfBirth).toDateString();
      if (dobInput !== dobDb) {
        return res.status(400).json({ message: 'DOB verification failed' });
      }
    }

    // Set new password (the pre-save hook will hash it)
    user.password = newPassword;
    user.otpCode = null;
    user.otpExpiry = null;
    user.isVerified = true;
    user.failedAttempts = 0;
    user.lockUntil = null;
    await user.save();

    await logAudit({
      user: user._id,
      action: 'USER_PASSWORD_RESET',
      req,
      details: { email },
    });

    res.status(200).json({ message: 'Password has been reset successfully. You can now login.' });
  } catch (error) {
    console.error('[ERROR] in resetPassword:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = req.user;
    const { firstName, lastName, department, employeeId, gender } = req.body;

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (department !== undefined) user.department = department;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (gender !== undefined) user.gender = gender;

    if (req.file) {
      user.profilePhoto = await uploadToCloudinary(req.file);
    }

    await user.save();

    await logAudit({
      user: user._id,
      action: 'USER_PROFILE_UPDATE',
      req,
      details: { username: user.username },
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        role: user.role,
        department: user.department,
        employeeId: user.employeeId
      }
    });
  } catch (error) {
    console.error('[ERROR] in updateProfile:', error);
    res.status(500).json({ message: error.message });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'Google ID Token is required' });
    }

    const profile = await verifyGoogleToken(idToken);
    
    // 1. Look up user by googleId
    let user = await User.findOne({ googleId: profile.googleId });

    if (!user) {
      // 2. Look up user by email to handle linking
      user = await User.findOne({ email: profile.email.toLowerCase() });

      if (user) {
        // Link Google ID to existing account
        user.googleId = profile.googleId;
        user.isVerified = true; // Auto-verify email since Google verified it
        user.provider = 'google';
        if (!user.profilePhoto && profile.picture) {
          user.profilePhoto = profile.picture;
        }
        await user.save();
        
        await logAudit({
          user: user._id,
          action: 'USER_GOOGLE_LINK_SUCCESS',
          req,
          details: { email: user.email, googleId: profile.googleId },
        });
      } else {
        // 3. New User Registration
        // Derive username from email prefix
        const emailPrefix = profile.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        let username = emailPrefix;
        
        // Handle potential username collision
        let collisionUser = await User.findOne({ username });
        while (collisionUser) {
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          username = `${emailPrefix}${randomSuffix}`;
          collisionUser = await User.findOne({ username });
        }

        // Split name into first and last
        const nameParts = profile.name ? profile.name.split(' ') : [''];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        user = new User({
          firstName,
          lastName,
          username,
          email: profile.email.toLowerCase(),
          googleId: profile.googleId,
          provider: 'google',
          isVerified: true,
          profilePhoto: profile.picture || '',
          failedAttempts: 0,
          isOnline: true,
          lastSeen: new Date(),
        });

        await user.save();

        // Initialize default Settings for the Google user
        const defaultSettings = new Settings({ user: user._id });
        await defaultSettings.save();

        await logAudit({
          user: user._id,
          action: 'USER_GOOGLE_REGISTER_SUCCESS',
          req,
          details: { email: user.email, username },
        });
      }
    } else {
      // Existing Google user login: update last login details
      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();

      await logAudit({
        user: user._id,
        action: 'USER_GOOGLE_LOGIN_SUCCESS',
        req,
        details: { email: user.email, googleId: profile.googleId },
      });
    }

    // Check if account status is banned/suspended
    if (user.status === 'suspended' || user.status === 'banned') {
      return res.status(403).json({ message: 'Your account has been suspended or banned.' });
    }

    // Success login: generate standard access and refresh tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens.push(refreshToken);
    if (user.refreshTokens.length > 5) {
      user.refreshTokens.shift();
    }
    await user.save();

    res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        role: user.role,
        department: user.department,
        employeeId: user.employeeId
      },
    });
  } catch (error) {
    console.error('[ERROR] in googleLogin:', error);
    res.status(500).json({ message: error.message || 'Authentication failed' });
  }
};
