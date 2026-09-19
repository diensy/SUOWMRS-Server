import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    // ── Customer Info ──
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerName: { type: String, required: true, trim: true },
    customerId: { type: String, trim: true, default: '' },
    email: { type: String, required: true, trim: true },
    houseId: { type: String, trim: true, default: '' },

    // ── Service / Plan ──
    planType: {
      type: String,
      required: true,
    },
    planLabel: { type: String, trim: true }, // human-readable label
    amount: { type: Number, required: true },      // in smallest currency unit (paise / cents)
    currency: { type: String, default: 'inr' },

    // ── Payment Status & Method ──
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'upi', 'upi_autopay', 'netbanking', 'wallet', 'auto-pay', 'other'],
      default: 'card',
    },
    upiId: { type: String, trim: true },
    bankName: { type: String, trim: true },

    // ── Stripe IDs ──
    stripePaymentIntentId: { type: String, trim: true },
    stripeSubscriptionId: { type: String, trim: true },
    stripeInvoiceId: { type: String, trim: true },
    stripeCustomerId: { type: String, trim: true },

    // ── Invoice ──
    invoiceNumber: { type: String, trim: true },
    invoiceUrl: { type: String, trim: true },    // Stripe hosted invoice URL
    receiptUrl: { type: String, trim: true },    // Stripe receipt URL

    // ── Recurring Flag ──
    isRecurring: { type: Boolean, default: false },
    nextDueDate: { type: Date },
    lastPaidDate: { type: Date },

    // ── Maintenance Workflow ──
    serviceTeamNotified: { type: Boolean, default: false },
    maintenanceCompleted: { type: Boolean, default: false },
    maintenanceCompletedAt: { type: Date },
    lastMaintenanceDate: { type: Date },

    // ── Failure Handling ──
    failureReason: { type: String, trim: true },
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-generate a sequential invoice number
paymentSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('Payment').countDocuments();
    this.invoiceNumber = `INV-SUO-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
