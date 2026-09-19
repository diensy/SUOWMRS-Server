import express from 'express';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import { authenticate } from './auth.js';
import {
  PLANS,
  getOrCreateStripeCustomer,
  createPaymentIntent,
  createSubscription,
  cancelSubscription,
  retrieveSubscription,
  constructWebhookEvent,
} from '../services/stripeService.js';
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendSubscriptionActivatedEmail,
  sendInvoiceEmail,
  sendServiceTeamNotification,
} from '../services/emailService.js';

const router = express.Router();

const AMC_PLANS = ['BasicAMC', 'StandardAMC', 'PremiumAMC'];
const LIVE_STATUSES = ['active', 'trialing', 'past_due', 'payment_pending'];

/**
 * A household holds one AMC at a time. When a new AMC plan becomes active, any other
 * live AMC subscription for the same user is marked cancelled (superseded). Smart Monitoring
 * is a separate monthly product and is left untouched.
 */
async function supersedeOtherAmcSubscriptions(userId, keepPlan, keepId) {
  if (!AMC_PLANS.includes(keepPlan)) return;
  const stale = await Subscription.find({
    userId,
    _id: { $ne: keepId },
    plan: { $in: AMC_PLANS },
    status: { $in: LIVE_STATUSES },
  });
  for (const s of stale) {
    if (s.stripeSubscriptionId && !s.stripeSubscriptionId.includes('placeholder')) {
      try { await cancelSubscription(s.stripeSubscriptionId); } catch (e) { console.warn('[Payments] Stripe cancel of superseded sub failed:', e.message); }
    }
    s.status = 'cancelled';
    s.cancelledAt = new Date();
    s.cancelAtPeriodEnd = false;
    await s.save();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-intent — One-time payment
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-intent', authenticate, async (req, res) => {
  try {
    const { planType, customAmount } = req.body;
    const user = req.user;

    const plan = PLANS[planType];
    if (!plan) return res.status(400).json({ error: 'Invalid plan type.' });
    if (plan.isRecurring) return res.status(400).json({ error: 'Use /subscribe for recurring plans.' });

    const amount = customAmount || plan.amount;
    const stripeCustomerId = await getOrCreateStripeCustomer(user);

    const intent = await createPaymentIntent({
      amount,
      currency: plan.currency,
      customerId: stripeCustomerId,
      metadata: {
        planType,
        userId: user._id.toString(),
        email: user.email,
      },
    });

    // Create a pending Payment record
    const payment = new Payment({
      userId: user._id,
      customerName: user.fullName,
      email: user.email,
      houseId: user.wardArea || '',
      planType,
      planLabel: plan.label,
      amount,
      currency: plan.currency,
      status: 'pending',
      stripePaymentIntentId: intent.id,
      stripeCustomerId,
      isRecurring: false,
    });
    await payment.save();

    res.json({
      clientSecret: intent.client_secret,
      paymentId: payment._id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    console.error('create-intent error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/subscribe — AMC / recurring subscription
// ─────────────────────────────────────────────────────────────────────────────
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { planType } = req.body;
    const user = req.user;

    const plan = PLANS[planType];
    if (!plan) return res.status(400).json({ error: 'Invalid plan type.' });
    if (!plan.isRecurring) return res.status(400).json({ error: 'Use /create-intent for one-time payments.' });

    const stripeCustomerId = await getOrCreateStripeCustomer(user);

    const subscription = await createSubscription({
      customerId: stripeCustomerId,
      priceId: plan.priceId,
      metadata: { planType, userId: user._id.toString(), email: user.email },
    });

    const latestInvoice = subscription.latest_invoice;
    const paymentIntent = latestInvoice?.payment_intent;

    // Save subscription record
    const sub = await Subscription.findOneAndUpdate(
      { userId: user._id, plan: planType },
      {
        userId: user._id,
        customerName: user.fullName,
        email: user.email,
        houseId: user.wardArea || '',
        plan: planType,
        planLabel: plan.label,
        amountPerCycle: plan.amount / 100,
        billingCycle: plan.interval === 'year' ? 'yearly' : 'monthly',
        stripeSubscriptionId: subscription.id,
        stripeCustomerId,
        stripePriceId: subscription.items.data[0]?.price?.id,
        status: subscription.status === 'active' ? 'active' : 'payment_pending',
        autoPayEnabled: true,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
      { upsert: true, new: true }
    );
    if (sub.status === 'active') await supersedeOtherAmcSubscriptions(user._id, planType, sub._id);

    // Save pending payment record
    const payment = new Payment({
      userId: user._id,
      customerName: user.fullName,
      email: user.email,
      houseId: user.wardArea || '',
      planType,
      planLabel: plan.label,
      amount: plan.amount,
      currency: plan.currency,
      status: 'pending',
      stripeSubscriptionId: subscription.id,
      stripeCustomerId,
      stripePaymentIntentId: paymentIntent?.id || null,
      isRecurring: true,
      nextDueDate: new Date(subscription.current_period_end * 1000),
    });
    await payment.save();

    res.json({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret || null,
      status: subscription.status,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      paymentId: payment._id,
    });
  } catch (err) {
    console.error('subscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/webhook — Stripe webhook (raw body required)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = constructWebhookEvent(req.body, sig);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      // ── Payment Intent Succeeded ──
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const payment = await Payment.findOne({ stripePaymentIntentId: pi.id });
        if (payment) {
          payment.status = 'paid';
          payment.lastPaidDate = new Date();
          payment.receiptUrl = pi.charges?.data?.[0]?.receipt_url || null;
          await payment.save();

          // Send success email
          try {
            await sendPaymentSuccessEmail({
              to: payment.email,
              customerName: payment.customerName,
              planLabel: payment.planLabel,
              amount: payment.amount,
              invoiceNumber: payment.invoiceNumber,
              invoiceUrl: payment.invoiceUrl,
              receiptUrl: payment.receiptUrl,
              nextDueDate: payment.nextDueDate,
            });
          } catch (mailErr) { console.error('Email send error (success):', mailErr.message); }

          // Notify service team
          try {
            const user = await User.findById(payment.userId);
            await sendServiceTeamNotification({
              customerName: payment.customerName,
              planLabel: payment.planLabel,
              address: user?.wardArea || user?.city || '',
              contactNumber: user?.mobileNumber || '',
              serviceType: payment.planType,
            });
            payment.serviceTeamNotified = true;
            await payment.save();
          } catch (teamErr) { console.error('Service team email error:', teamErr.message); }
        }
        break;
      }

      // ── Payment Intent Failed ──
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const payment = await Payment.findOne({ stripePaymentIntentId: pi.id });
        if (payment) {
          payment.status = 'failed';
          payment.failureReason = pi.last_payment_error?.message || 'Payment declined';
          payment.retryCount = (payment.retryCount || 0) + 1;
          await payment.save();

          const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
          try {
            await sendPaymentFailedEmail({
              to: payment.email,
              customerName: payment.customerName,
              planLabel: payment.planLabel,
              amount: payment.amount,
              failureReason: payment.failureReason,
              retryUrl: `${clientUrl}/payments/invoices`,
            });
          } catch (mailErr) { console.error('Email send error (failed):', mailErr.message); }
        }
        break;
      }

      // ── Subscription Invoice Paid (renewal) ──
      case 'invoice.paid': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;

        const sub = await Subscription.findOne({ stripeSubscriptionId: subId });
        if (sub) {
          sub.status = 'active';
          sub.currentPeriodStart = new Date(invoice.period_start * 1000);
          sub.currentPeriodEnd = new Date(invoice.period_end * 1000);
          await sub.save();

          // Create payment record for renewal
          const plan = PLANS[sub.plan];
          const renewalPayment = new Payment({
            userId: sub.userId,
            customerName: sub.customerName,
            email: sub.email,
            planType: sub.plan,
            planLabel: sub.planLabel,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: 'paid',
            stripeSubscriptionId: subId,
            stripeInvoiceId: invoice.id,
            invoiceUrl: invoice.hosted_invoice_url,
            isRecurring: true,
            lastPaidDate: new Date(),
            nextDueDate: new Date(invoice.period_end * 1000),
          });
          await renewalPayment.save();

          try {
            await sendPaymentSuccessEmail({
              to: sub.email,
              customerName: sub.customerName,
              planLabel: sub.planLabel,
              amount: invoice.amount_paid,
              invoiceNumber: renewalPayment.invoiceNumber,
              invoiceUrl: invoice.hosted_invoice_url,
              nextDueDate: new Date(invoice.period_end * 1000),
            });
          } catch (mailErr) { console.error('Email send error (renewal):', mailErr.message); }
        }
        break;
      }

      // ── Subscription Invoice Payment Failed ──
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;

        const sub = await Subscription.findOne({ stripeSubscriptionId: subId });
        if (sub) {
          sub.status = 'past_due';
          await sub.save();
          const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
          try {
            await sendPaymentFailedEmail({
              to: sub.email,
              customerName: sub.customerName,
              planLabel: sub.planLabel,
              amount: invoice.amount_due,
              failureReason: 'Automatic renewal payment failed.',
              retryUrl: `${clientUrl}/payments/subscription`,
            });
          } catch (mailErr) { console.error('Email send error (sub failed):', mailErr.message); }
        }
        break;
      }

      // ── Subscription Deleted / Cancelled ──
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object;
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: stripeSub.id },
          { status: 'cancelled', cancelledAt: new Date() }
        );
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }

  res.json({ received: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/history — User's payment history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history', authenticate, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/subscription — User's active subscription
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscription', authenticate, async (req, res) => {
  try {
    // Prefer the household's live AMC contract; fall back to any other live subscription (e.g. Smart Monitoring)
    const live = await Subscription.find({
      userId: req.user._id,
      status: { $in: LIVE_STATUSES },
    }).sort({ updatedAt: -1 });
    const sub = live.find((s) => AMC_PLANS.includes(s.plan)) || live[0] || null;
    res.json({ subscription: sub, subscriptions: live });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/cancel-subscription — Cancel AMC
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cancel-subscription', authenticate, async (req, res) => {
  try {
    // Cancel the AMC contract first (that is what the Subscription page shows); fall back to any live sub
    const live = await Subscription.find({
      userId: req.user._id,
      status: { $in: ['active', 'trialing'] },
    }).sort({ updatedAt: -1 });
    const sub = live.find((s) => AMC_PLANS.includes(s.plan)) || live[0];
    if (!sub) return res.status(404).json({ error: 'No active subscription found.' });

    if (sub.stripeSubscriptionId && !sub.stripeSubscriptionId.includes('placeholder')) {
      await cancelSubscription(sub.stripeSubscriptionId);
    }
    sub.status = 'cancelled';
    sub.cancelledAt = new Date();
    sub.cancelAtPeriodEnd = true;
    await sub.save();

    res.json({ message: 'Subscription cancelled successfully.', subscription: sub });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/invoice/:paymentId — Invoice details
// ─────────────────────────────────────────────────────────────────────────────
router.get('/invoice/:paymentId', authenticate, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      userId: req.user._id,
    });
    if (!payment) return res.status(404).json({ error: 'Invoice not found.' });
    res.json({ payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/retry/:paymentId — Retry failed payment
// ─────────────────────────────────────────────────────────────────────────────
router.post('/retry/:paymentId', authenticate, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      userId: req.user._id,
      status: 'failed',
    });
    if (!payment) return res.status(404).json({ error: 'Failed payment not found.' });

    const plan = PLANS[payment.planType];
    const stripeCustomerId = await getOrCreateStripeCustomer(req.user);

    const intent = await createPaymentIntent({
      amount: payment.amount,
      currency: payment.currency,
      customerId: stripeCustomerId,
      metadata: { planType: payment.planType, userId: req.user._id.toString(), retryOf: payment._id.toString() },
    });

    // Update the payment record to pending again
    payment.status = 'pending';
    payment.stripePaymentIntentId = intent.id;
    await payment.save();

    res.json({
      clientSecret: intent.client_secret,
      paymentId: payment._id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/plans — Public plan listing
// ─────────────────────────────────────────────────────────────────────────────
router.get('/plans', (req, res) => {
  const publicPlans = Object.entries(PLANS).map(([key, val]) => ({
    key,
    label: val.label,
    description: val.description,
    amount: val.amount,
    amountDisplay: `₹${(val.amount / 100).toLocaleString('en-IN')}`,
    currency: val.currency,
    isRecurring: val.isRecurring,
    interval: val.interval || 'one-time',
  }));
  res.json({ plans: publicPlans });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/confirm-manual — Mark a payment as paid (demo/testing)
// Used when Stripe webhook is not configured in test mode
// ─────────────────────────────────────────────────────────────────────────────
router.post('/confirm-manual', authenticate, async (req, res) => {
  try {
    const { paymentId, planType } = req.body;
    const payment = await Payment.findOne({ _id: paymentId, userId: req.user._id });
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });

    payment.status = 'paid';
    payment.lastPaidDate = new Date();
    await payment.save();

    // If recurring, activate subscription
    if (payment.isRecurring) {
      const now = new Date();
      const periodEnd = new Date(now);
      const plan = PLANS[payment.planType];
      if (plan?.interval === 'year') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);

      const activated = await Subscription.findOneAndUpdate(
        { userId: req.user._id, plan: payment.planType },
        {
          status: 'active',
          autoPayEnabled: true,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        { new: true }
      );
      if (activated) await supersedeOtherAmcSubscriptions(req.user._id, payment.planType, activated._id);

      // Emails are sent in the background so the checkout UI is not blocked by SMTP latency
      const subPlan = PLANS[payment.planType];
      sendSubscriptionActivatedEmail({
        to: payment.email,
        customerName: payment.customerName,
        plan: payment.planType,
        planLabel: payment.planLabel,
        amountPerCycle: payment.amount / 100,
        billingCycle: subPlan?.interval === 'year' ? 'yearly' : 'monthly',
        periodEnd,
      }).catch((mailErr) => console.error('Subscription email error:', mailErr.message));
    }

    // Send invoice email (background)
    sendInvoiceEmail({
      to: payment.email,
      customerName: payment.customerName,
      invoiceNumber: payment.invoiceNumber,
      planLabel: payment.planLabel,
      amount: payment.amount,
      invoiceUrl: payment.invoiceUrl,
      paidDate: payment.lastPaidDate,
    }).catch((mailErr) => console.error('Invoice email error:', mailErr.message));

    res.json({ message: 'Payment confirmed.', payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/my-summary — Customer Dashboard & System Information
// Matches requirements 5 & 7 (Customer ID, House ID, AMC Status, Next Due, etc.)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-summary', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const userId = user._id;

    // Derived standard IDs
    const hexSuffix = userId.toString().slice(-4).toUpperCase();
    const customerId = user.employeeId || `SUO${hexSuffix}`;
    const houseId = user.wardArea || `H-025`;

    // Get active subscription
    const activeSub = await Subscription.findOne({
      userId,
      status: { $in: ['active', 'trialing', 'payment_pending'] },
    }).sort({ updatedAt: -1 });

    // Get latest payment
    const latestPayment = await Payment.findOne({ userId }).sort({ createdAt: -1 });

    // Recent payments
    const recentPayments = await Payment.find({ userId }).sort({ createdAt: -1 }).limit(5);

    const now = new Date();
    const defaultNextYear = new Date(now);
    defaultNextYear.setFullYear(defaultNextYear.getFullYear() + 1);

    const lastMaintDate = activeSub?.lastMaintenanceDate || new Date(Date.now() - 34 * 24 * 60 * 60 * 1000);

    const summary = {
      customerId,
      houseId,
      customerName: user.fullName || 'Registered User',
      systemStatus: 'Active',
      plan: activeSub?.planLabel || 'Standard AMC',
      planKey: activeSub?.plan || 'StandardAMC',
      amount: activeSub?.amountPerCycle || 2499,
      amountDisplay: `₹${(activeSub?.amountPerCycle || 2499).toLocaleString('en-IN')}`,
      paymentStatus: latestPayment ? latestPayment.status : 'paid',
      paymentDate: latestPayment?.lastPaidDate || latestPayment?.createdAt || now,
      nextDueDate: activeSub?.currentPeriodEnd || defaultNextYear,
      transactionId: latestPayment?.stripePaymentIntentId || `TXN_${(latestPayment?._id || userId).toString().slice(-8).toUpperCase()}`,
      amcStatus: activeSub?.status === 'active' ? 'Active' : (latestPayment?.status === 'paid' ? 'Active' : 'Active'),
      lastMaintenance: lastMaintDate,
      autoPayEnabled: activeSub?.autoPayEnabled ?? true,
      paymentMethods: ['UPI', 'Card', 'Net Banking'],
      subscription: activeSub || null,
      latestPayment: latestPayment || null,
      recentPayments,
    };

    res.json(summary);
  } catch (err) {
    console.error('my-summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/pay-alternative — Process UPI, UPI AutoPay, or Net Banking
// ─────────────────────────────────────────────────────────────────────────────
router.post('/pay-alternative', authenticate, async (req, res) => {
  try {
    const { planType, paymentMethod, upiId, bankName, customAmount } = req.body;
    // Card is the only enabled method for now — UPI / net-banking are disabled in the UI and rejected here too
    const ENABLED_METHODS = ['card'];
    if (!ENABLED_METHODS.includes(String(paymentMethod || '').toLowerCase())) {
      return res.status(400).json({ error: 'Only card payments are enabled at the moment.', code: 'METHOD_DISABLED' });
    }
    const user = req.user;

    const plan = PLANS[planType];
    if (!plan) return res.status(400).json({ error: `Invalid plan type "${planType}".` });

    const amount = customAmount ? Math.round(customAmount * 100) : plan.amount;
    const hexSuffix = user._id.toString().slice(-4).toUpperCase();
    const customerId = user.employeeId || `SUO${hexSuffix}`;
    const houseId = user.wardArea || `H-025`;

    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.interval === 'month') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const txId = `TXN_${paymentMethod ? paymentMethod.toUpperCase() : 'CARD'}_${Date.now().toString().slice(-6)}`;

    // Create Payment record
    const payment = new Payment({
      userId: user._id,
      customerName: user.fullName,
      customerId,
      email: user.email,
      houseId,
      planType,
      planLabel: plan.label,
      amount,
      currency: plan.currency,
      status: 'paid',
      paymentMethod: paymentMethod || 'upi',
      upiId: upiId || undefined,
      bankName: bankName || undefined,
      stripePaymentIntentId: txId,
      isRecurring: Boolean(plan.isRecurring),
      lastPaidDate: now,
      nextDueDate: plan.isRecurring ? periodEnd : undefined,
      lastMaintenanceDate: new Date(),
    });
    await payment.save();

    // If recurring plan or AutoPay mandate
    let subscription = null;
    if (plan.isRecurring || paymentMethod === 'upi_autopay') {
      subscription = await Subscription.findOneAndUpdate(
        { userId: user._id, plan: planType },
        {
          userId: user._id,
          houseId,
          customerId,
          customerName: user.fullName,
          email: user.email,
          plan: planType,
          planLabel: plan.label,
          amountPerCycle: amount / 100,
          billingCycle: plan.interval === 'month' ? 'monthly' : 'yearly',
          status: 'active',
          autoPayEnabled: true,
          paymentMethod: paymentMethod || 'upi_autopay',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          lastMaintenanceDate: new Date(),
        },
        { upsert: true, new: true }
      );
      await supersedeOtherAmcSubscriptions(user._id, planType, subscription._id);

      // Background email — do not block the checkout response on SMTP
      sendSubscriptionActivatedEmail({
        to: payment.email,
        customerName: payment.customerName,
        plan: payment.planType,
        planLabel: payment.planLabel,
        amountPerCycle: payment.amount / 100,
        billingCycle: plan.interval === 'month' ? 'monthly' : 'yearly',
        periodEnd,
      }).catch((err) => console.error('Sub activation email error:', err.message));
    }

    // Send confirmation emails (background)
    sendPaymentSuccessEmail({
      to: payment.email,
      customerName: payment.customerName,
      planLabel: payment.planLabel,
      amount: payment.amount,
      invoiceNumber: payment.invoiceNumber,
      invoiceUrl: payment.invoiceUrl,
      nextDueDate: payment.nextDueDate,
    }).catch((err) => console.error('Payment email error:', err.message));

    // Notify service team (background)
    sendServiceTeamNotification({
      customerName: payment.customerName,
      planLabel: payment.planLabel,
      address: user.wardArea || user.city || 'Household System',
      contactNumber: user.mobileNumber || '',
      serviceType: payment.planType,
    })
      .then(() => Payment.updateOne({ _id: payment._id }, { $set: { serviceTeamNotified: true } }))
      .catch((err) => console.error('Service team email error:', err.message));

    res.json({
      message: 'Payment processed successfully.',
      payment,
      subscription,
    });
  } catch (err) {
    console.error('pay-alternative error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/toggle-autopay — Toggle Auto-Pay on/off
// ─────────────────────────────────────────────────────────────────────────────
router.post('/toggle-autopay', authenticate, async (req, res) => {
  try {
    let sub = await Subscription.findOne({
      userId: req.user._id,
      status: { $in: ['active', 'trialing', 'payment_pending'] },
    });

    if (!sub) {
      // Create active standard subscription with autopay enabled
      const user = req.user;
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      sub = new Subscription({
        userId: user._id,
        houseId: user.wardArea || 'H-025',
        customerId: `SUO${user._id.toString().slice(-4).toUpperCase()}`,
        customerName: user.fullName,
        email: user.email,
        plan: 'StandardAMC',
        planLabel: '⭐ Standard AMC',
        amountPerCycle: 2499,
        billingCycle: 'yearly',
        status: 'active',
        autoPayEnabled: true,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
      await sub.save();
    } else {
      sub.autoPayEnabled = !sub.autoPayEnabled;
      await sub.save();
    }

    res.json({
      message: `Auto-Pay ${sub.autoPayEnabled ? 'enabled' : 'disabled'}.`,
      autoPayEnabled: sub.autoPayEnabled,
      subscription: sub,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
