import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email Address is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile Number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type: String,
      enum: ['Resident', 'Technician', 'Admin'],
      default: 'Resident',
    },

    // ── Resident Specific Fields ──
    city: {
      type: String,
      trim: true,
    },
    wardArea: {
      type: String,
      trim: true,
    },

    // ── Technician Specific Fields ──
    employeeId: {
      type: String,
      trim: true,
    },
    organization: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },

    // ── Municipality / Authority Specific Fields ──
    municipalityName: {
      type: String,
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
    },
    officialEmployeeId: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    isAuthorizedRepresentative: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending',
    },

    agreedToTerms: {
      type: Boolean,
      required: [true, 'You must agree to the Terms & Conditions'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
