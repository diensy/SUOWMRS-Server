import mongoose from 'mongoose';

const servicePlanSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // e.g. 'BasicAMC', 'EmergencyService'
    },
    label: { type: String, required: true, trim: true },
    icon: { type: String, default: '🔧' },
    description: { type: String, trim: true },
    amount: { type: Number, required: true }, // in paise (₹ × 100)
    currency: { type: String, default: 'inr' },
    isRecurring: { type: Boolean, default: false },
    interval: {
      type: String,
      enum: ['month', 'year', 'one-time'],
      default: 'one-time',
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    features: [{ type: String, trim: true }],
    category: {
      type: String,
      enum: ['amc', 'monitoring', 'service', 'emergency'],
      default: 'service',
    },
  },
  { timestamps: true }
);

const ServicePlan = mongoose.model('ServicePlan', servicePlanSchema);
export default ServicePlan;
