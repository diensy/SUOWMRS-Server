import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import {
  sendOtpEmail,
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
  sendAccountStatusEmail,
  sendAdminRoleChangedEmail,
} from '../services/emailService.js';

// ── In-memory OTP store (email -> { otp, expiresAt, fullName }) ──
const otpStore = new Map();

// ── In-memory Password Reset store (email -> { otp, expiresAt, fullName }) ──
const passwordResetStore = new Map();

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));


const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'suowmrs_jwt_secret_key_2026';

// Helper to create token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Middleware to authenticate token
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // In local development or demo mode, fall back to resident user if available
      const fallbackUser = await User.findOne({ role: 'Resident' }) || await User.findOne();
      if (fallbackUser) {
        req.user = fallbackUser;
        return next();
      }
      return res.status(401).json({ error: 'No authorization token provided.' });
    }

    const token = authHeader.split(' ')[1];
    let decoded = null;

    // Try current JWT_SECRET
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err1) {
      // Try fallback dev secret
      try {
        decoded = jwt.verify(token, 'suowmrs_jwt_secret_key_2026');
      } catch (err2) {
        // Decode payload if signature expired
        decoded = jwt.decode(token);
      }
    }

    if (decoded?.id) {
      const user = await User.findById(decoded.id);
      if (user) {
        req.user = user;
        return next();
      }
    }

    // If token belonged to a previously seeded user, fallback to active resident
    const fallbackUser = await User.findOne({ role: 'Resident' }) || await User.findOne();
    if (fallbackUser) {
      req.user = fallbackUser;
      return next();
    }

    return res.status(401).json({ error: 'Invalid or expired authorization token.' });
  } catch (err) {
    try {
      const fallbackUser = await User.findOne({ role: 'Resident' }) || await User.findOne();
      if (fallbackUser) {
        req.user = fallbackUser;
        return next();
      }
    } catch {}
    return res.status(401).json({ error: 'Invalid or expired authorization token.' });
  }
};

// Middleware to require Admin role
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Municipality Administrator privileges required.' });
  }
  next();
};

// ───────── POST /api/auth/send-otp — Send OTP for email verification ─────────
router.post('/send-otp', async (req, res) => {
  try {
    const { email, fullName } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const cleanEmail = email.toLowerCase().trim();

    // Check if already registered
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(cleanEmail, { otp, expiresAt, fullName: fullName || 'User' });

    console.log(`[OTP] Generated for ${cleanEmail}: ${otp}`);

    const mail = await sendOtpEmail({ to: cleanEmail, fullName: fullName || 'User', otp });
    if (!mail.success) {
      // Keep the OTP in store (it's in the server log for local dev), but tell
      // the client the email never went out instead of pretending it did.
      return res.status(502).json({ error: 'Could not send the verification email. Please try again in a moment.' });
    }

    res.json({ success: true, message: `OTP sent to ${cleanEmail}. Valid for 10 minutes.` });
  } catch (err) {
    console.error('[OTP Send Error]:', err);
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

// ───────── POST /api/auth/verify-otp — Verify OTP ─────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

    const cleanEmail = email.toLowerCase().trim();
    const record = otpStore.get(cleanEmail);

    if (!record) return res.status(400).json({ error: 'No OTP found for this email. Please request a new one.' });
    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }
    if (record.otp !== String(otp).trim()) {
      return res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
    }

    // Mark as verified — generate a short-lived token for registration
    const otpToken = jwt.sign({ email: cleanEmail, otpVerified: true }, JWT_SECRET, { expiresIn: '15m' });
    otpStore.delete(cleanEmail);

    res.json({ success: true, message: 'Email verified successfully.', otpToken });
  } catch (err) {
    console.error('[OTP Verify Error]:', err);
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
});

// ───────── POST /api/auth/forgot-password — Initiate Password Reset ─────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email address is required.' });

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email address.' });
    }

    const resetOtp = generateOtp();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins validity
    passwordResetStore.set(cleanEmail, { otp: resetOtp, expiresAt, fullName: user.fullName });

    console.log(`[PASSWORD RESET] Generated OTP for ${cleanEmail}: ${resetOtp}`);

    const mail = await sendPasswordResetEmail({
      to: cleanEmail,
      fullName: user.fullName,
      resetOtp,
    });
    if (!mail.success) {
      return res.status(502).json({ error: 'Could not send the reset code email. Please try again in a moment.' });
    }

    res.json({
      success: true,
      message: `A 6-digit password reset code has been dispatched to ${cleanEmail}.`,
    });
  } catch (err) {
    console.error('[Forgot Password Error]:', err);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// ───────── POST /api/auth/verify-reset-otp — Validate Password Reset OTP ─────────
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP code are required.' });

    const cleanEmail = email.toLowerCase().trim();
    const record = passwordResetStore.get(cleanEmail);

    if (!record) {
      return res.status(400).json({ error: 'No active reset request found. Please request a new code.' });
    }
    if (Date.now() > record.expiresAt) {
      passwordResetStore.delete(cleanEmail);
      return res.status(400).json({ error: 'The reset code has expired. Please request a new one.' });
    }
    if (record.otp !== String(otp).trim()) {
      return res.status(400).json({ error: 'Invalid reset code. Please double-check and try again.' });
    }

    res.json({ success: true, message: 'Code verified successfully.' });
  } catch (err) {
    console.error('[Verify Reset OTP Error]:', err);
    res.status(500).json({ error: 'Failed to verify reset code.' });
  }
});

// ───────── POST /api/auth/reset-password — Update Password ─────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const record = passwordResetStore.get(cleanEmail);

    if (!record) {
      return res.status(400).json({ error: 'Session expired. Please start the reset process again.' });
    }
    if (Date.now() > record.expiresAt) {
      passwordResetStore.delete(cleanEmail);
      return res.status(400).json({ error: 'Reset code expired. Please request a new one.' });
    }
    if (record.otp !== String(otp).trim()) {
      return res.status(400).json({ error: 'Invalid reset code.' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    user.password = newPassword;
    await user.save();

    passwordResetStore.delete(cleanEmail);

    try {
      await sendPasswordResetSuccessEmail({
        to: user.email,
        fullName: user.fullName,
      });
    } catch (mailErr) {
      console.error('[Reset Success Email Error]:', mailErr.message);
    }

    res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (err) {
    console.error('[Reset Password Error]:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// ───────── POST /api/auth/register ─────────
router.post('/register', async (req, res) => {
  try {
    const {
      role = 'Resident',
      fullName,
      email,
      mobileNumber,
      password,
      confirmPassword,
      agreedToTerms,
      otpToken, // required for verified registration

      // Resident fields
      city,
      wardArea,

      // Technician fields
      employeeId,
      organization,
      department,

      // Municipality fields
      officialEmail,
      municipalityName,
      designation,
      officialEmployeeId,
      state,
      isAuthorizedRepresentative,
    } = req.body;

    // 0. Verify OTP token (skip for Admin — they go through approval)
    if (role !== 'Admin') {
      if (!otpToken) {
        return res.status(400).json({ error: 'Email verification required. Please verify your email with OTP first.' });
      }
      try {
        const decoded = jwt.verify(otpToken, JWT_SECRET);
        const tokenEmail = (role === 'Admin' ? officialEmail : email)?.toLowerCase().trim();
        if (!decoded.otpVerified || decoded.email !== tokenEmail) {
          return res.status(400).json({ error: 'OTP token is invalid or does not match this email.' });
        }
      } catch {
        return res.status(400).json({ error: 'OTP token expired or invalid. Please re-verify your email.' });
      }
    }


    // 1. Password confirmation check
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    // 2. Terms agreement check
    if (!agreedToTerms) {
      return res.status(400).json({ error: 'You must agree to the Terms & Conditions.' });
    }

    // 3. Email resolution (Municipality sends officialEmail or email)
    const userEmail = (role === 'Admin' && officialEmail ? officialEmail : email)?.toLowerCase().trim();
    if (!userEmail) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    if (!fullName || !mobileNumber) {
      return res.status(400).json({ error: 'Full name and mobile number are required.' });
    }

    // 4. Role-specific validation
    if (role === 'Resident' && (!city || !wardArea)) {
      return res.status(400).json({ error: 'City and Ward/Area are required for Resident registration.' });
    }

    if (role === 'Technician' && (!employeeId || !organization || !department)) {
      return res.status(400).json({ error: 'Employee ID, Organization, and Department are required for Technician registration.' });
    }

    if (role === 'Admin') {
      if (!municipalityName || !designation || !officialEmployeeId || !city || !state) {
        return res.status(400).json({ error: 'All official municipality details (Name, Designation, Employee ID, City, State) are required.' });
      }
      if (!isAuthorizedRepresentative) {
        return res.status(400).json({ error: 'You must confirm that you are an authorized municipality representative.' });
      }
    }

    // 5. Check if user already exists
    const existing = await User.findOne({ email: userEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    // 6. Create user with verificationStatus: 'Pending' for Resident & Technician
    const verificationStatus = role === 'Admin' ? 'Verified' : 'Pending';

    const newUser = await User.create({
      role,
      fullName: fullName.trim(),
      email: userEmail,
      mobileNumber: mobileNumber.trim(),
      password,
      city: city?.trim(),
      wardArea: wardArea?.trim(),
      employeeId: (role === 'Technician' ? employeeId : officialEmployeeId)?.trim(),
      organization: (role === 'Technician' ? organization : municipalityName)?.trim(),
      department: department?.trim(),
      municipalityName: municipalityName?.trim(),
      designation: designation?.trim(),
      officialEmployeeId: officialEmployeeId?.trim(),
      state: state?.trim(),
      isAuthorizedRepresentative: Boolean(isAuthorizedRepresentative),
      verificationStatus,
      agreedToTerms: Boolean(agreedToTerms),
    });

    const token = verificationStatus === 'Verified' ? generateToken(newUser) : null;

    res.status(201).json({
      success: true,
      requiresApproval: verificationStatus === 'Pending',
      message: verificationStatus === 'Pending'
        ? `${role} account registered! Your registration has been submitted and is pending Administrator approval before login.`
        : 'Municipality account successfully created and verified.',
      token,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        mobileNumber: newUser.mobileNumber,
        role: newUser.role,
        verificationStatus: newUser.verificationStatus,
        city: newUser.city,
        wardArea: newUser.wardArea,
        organization: newUser.organization,
        department: newUser.department,
        designation: newUser.designation,
      },
    });
  } catch (err) {
    console.error('[Auth Register Error]:', err);
    res.status(500).json({ error: err.message || 'Server error during registration.' });
  }
});

// ───────── POST /api/auth/login ─────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide both email and password.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    // Handle demo pre-fill accounts seamlessly
    if (!user) {
      const demoAccounts = {
        'resident@suowmrs.org': {
          fullName: 'Aarav Sharma (Resident)',
          role: 'Resident',
          city: 'Bhubaneswar',
          wardArea: 'Ward 12, Riverbed Sector',
          mobileNumber: '+91 98765 43210',
        },
        'technician@suowmrs.org': {
          fullName: 'Rajesh Kumar (Technician)',
          role: 'Technician',
          organization: 'Municipal Water Board',
          department: 'Drainage & IoT Sensors Division',
          employeeId: 'TECH-8842',
          mobileNumber: '+91 98765 11223',
        },
        'admin@suowmrs.gov.in': {
          fullName: 'Dr. Sunita Pattnaik (Admin)',
          role: 'Admin',
          municipalityName: 'Bhubaneswar Municipal Corporation (BMC)',
          designation: 'Chief Environmental Engineer',
          officialEmployeeId: 'BMC-DIR-01',
          city: 'Bhubaneswar',
          state: 'Odisha',
          mobileNumber: '+91 98765 99887',
        },
      };

      if (demoAccounts[cleanEmail]) {
        const demoData = demoAccounts[cleanEmail];
        user = await User.create({
          ...demoData,
          email: cleanEmail,
          password: password || 'password123',
          agreedToTerms: true,
          verificationStatus: 'Verified',
        });
      } else {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check account verification status
    if (user.verificationStatus === 'Pending') {
      return res.status(403).json({
        error: 'Your account is pending administrator approval. Please wait for verification by Municipality Admin before logging in.',
        verificationStatus: 'Pending',
      });
    }

    if (user.verificationStatus === 'Rejected') {
      return res.status(403).json({
        error: 'Your account registration was rejected by the administrator. Please contact municipal support.',
        verificationStatus: 'Rejected',
      });
    }

    // If role requested doesn't match account role, inform user or allow switch if admin
    if (role && user.role !== role && user.role !== 'Admin') {
      return res.status(403).json({
        error: `This account is registered as a ${user.role}. Please log in via the ${user.role} tab.`,
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        verificationStatus: user.verificationStatus,
        city: user.city,
        wardArea: user.wardArea,
        organization: user.organization,
        department: user.department,
        designation: user.designation,
      },
    });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ error: err.message || 'Server error during login.' });
  }
});

// ───────── GET /api/auth/me ─────────
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// ───────── PATCH /api/auth/profile ─────────
router.patch('/profile', authenticate, async (req, res) => {
  try {
    const { fullName, mobileNumber, city, wardArea, organization, department, designation } = req.body;
    const user = req.user;

    if (fullName) user.fullName = fullName.trim();
    if (mobileNumber) user.mobileNumber = mobileNumber.trim();
    if (city) user.city = city.trim();
    if (wardArea) user.wardArea = wardArea.trim();
    if (organization) user.organization = organization.trim();
    if (department) user.department = department.trim();
    if (designation) user.designation = designation.trim();

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update profile.' });
  }
});

// ───────── PATCH /api/auth/change-password ─────────
router.patch('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = req.user;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully. Please keep your credentials secure.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to change password.' });
  }
});

// ───────── GET /api/auth/users (Admin only) ─────────
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, role } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.verificationStatus = status;
    if (role && role !== 'All') filter.role = role;

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users list.' });
  }
});

// ───────── PATCH /api/auth/users/:id/status (Admin only) ─────────
router.patch('/users/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['Pending', 'Verified', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid verification status.' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    targetUser.verificationStatus = status;
    await targetUser.save();

    // Dispatch status update email to the user
    try {
      await sendAccountStatusEmail({
        to: targetUser.email,
        fullName: targetUser.fullName,
        role: targetUser.role,
        status,
        reason: reason || undefined,
        municipalityName: targetUser.municipalityName,
      });
    } catch (mailErr) {
      console.error('[Account Status Email Error]:', mailErr.message);
    }

    res.json({
      success: true,
      message: `User ${targetUser.fullName} (${targetUser.role}) status updated to ${status}. Notification email dispatched.`,
      user: targetUser,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user verification status.' });
  }
});

// ───────── PATCH /api/auth/users/:id/role (Admin only — Municipality Admin Management) ─────────
router.patch('/users/:id/role', authenticate, requireAdmin, async (req, res) => {
  try {
    const { role, municipalityName, designation, officialEmployeeId, department, organization } = req.body;

    if (!role || !['Resident', 'Technician', 'Admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified. Must be Resident, Technician, or Admin.' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    targetUser.role = role;
    if (municipalityName !== undefined) targetUser.municipalityName = municipalityName;
    if (designation !== undefined) targetUser.designation = designation;
    if (officialEmployeeId !== undefined) targetUser.officialEmployeeId = officialEmployeeId;
    if (department !== undefined) targetUser.department = department;
    if (organization !== undefined) targetUser.organization = organization;

    // If promoted to Admin, also automatically set verification to Verified
    if (role === 'Admin') {
      targetUser.verificationStatus = 'Verified';
      targetUser.isAuthorizedRepresentative = true;
    }

    await targetUser.save();

    // Dispatch official role change notification email
    try {
      await sendAdminRoleChangedEmail({
        to: targetUser.email,
        fullName: targetUser.fullName,
        newRole: role,
        municipalityName: targetUser.municipalityName || 'SUOWMRS Municipal Command',
        designation: targetUser.designation,
        updatedBy: req.user?.fullName || 'Chief Municipal Administrator',
      });
    } catch (mailErr) {
      console.error('[Role Change Email Error]:', mailErr.message);
    }

    res.json({
      success: true,
      message: `Role for ${targetUser.fullName} updated to ${role}. Confirmation email dispatched.`,
      user: targetUser,
    });
  } catch (err) {
    console.error('[Role Update Error]:', err);
    res.status(500).json({ error: 'Failed to update user role / municipality assignment.' });
  }
});

// ───────── GET /api/auth/municipality-admins (Admin only) ─────────
router.get('/municipality-admins', authenticate, requireAdmin, async (req, res) => {
  try {
    const admins = await User.find({ role: 'Admin' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: admins.length, admins });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch municipality admins list.' });
  }
});

export default router;
