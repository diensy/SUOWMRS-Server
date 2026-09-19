import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    houseId: { type: String, trim: true, default: '' },
    customerId: { type: String, trim: true, default: '' },
    customerName: { type: String, trim: true },
    email: { type: String, trim: true },
    paymentMethod: { type: String, default: 'auto-pay' },

    // ── Plan ──
    plan: {
      type: String,
      enum: ['BasicAMC', 'StandardAMC', 'PremiumAMC', 'SmartMonitoring'],
      required: true,
    },
    planLabel: { type: String, trim: true },
    amountPerCycle: { type: Number }, // in INR (₹)
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'yearly',
    },

    // ── Stripe ──
    stripeSubscriptionId: { type: String, trim: true },
    stripeCustomerId: { type: String, trim: true },
    stripePriceId: { type: String, trim: true },

    // ── Subscription Lifecycle ──
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'cancelled', 'unpaid', 'payment_pending'],
      default: 'payment_pending',
    },
    autoPayEnabled: { type: Boolean, default: false },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: { type: Date },

    // ── Maintenance ──
    lastMaintenanceDate: { type: Date },
    nextMaintenanceDate: { type: Date },
  },
  { timestamps: true }
);

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
