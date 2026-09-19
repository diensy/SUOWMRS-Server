import 'dotenv/config';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key_for_dev_mode_00000000000000';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
});

// ── AMC plan configuration ──
export const PLANS = {
  BasicAMC: {
    label: '🔧 Basic AMC',
    description: 'Annual Maintenance Contract — Basic',
    amount: 149900, // ₹1,499 in paise
    currency: 'inr',
    interval: 'year',
    priceId: process.env.STRIPE_PRICE_BASIC_AMC,
    isRecurring: true,
  },
  StandardAMC: {
    label: '⭐ Standard AMC',
    description: 'Annual Maintenance Contract — Standard',
    amount: 249900, // ₹2,499 in paise
    currency: 'inr',
    interval: 'year',
    priceId: process.env.STRIPE_PRICE_STANDARD_AMC,
    isRecurring: true,
  },
  PremiumAMC: {
    label: '💎 Premium AMC',
    description: 'Annual Maintenance Contract — Premium',
    amount: 399900, // ₹3,999 in paise
    currency: 'inr',
    interval: 'year',
    priceId: process.env.STRIPE_PRICE_PREMIUM_AMC,
    isRecurring: true,
  },
  SmartMonitoring: {
    label: '📱 Smart Monitoring',
    description: 'Smart Monitoring Subscription — Monthly',
    amount: 9900,  // ₹99/month in paise
    currency: 'inr',
    interval: 'month',
    priceId: process.env.STRIPE_PRICE_SMART_MONITORING,
    isRecurring: true,
  },
  FilterBasic: {
    label: '💧 Sediment Filter Replacement',
    description: 'Basic Sediment & Pre-filter Replacement',
    amount: 50000, // ₹500 in paise
    currency: 'inr',
    isRecurring: false,
  },
  FilterReplacement: {
    label: '💧 Standard Filter Replacement',
    description: 'Water Filter Inspection and Replacement Service',
    amount: 100000, // ₹1,000 default
    currency: 'inr',
    isRecurring: false,
  },
  FilterComplete: {
    label: '💧 Complete RO/UV Filter Kit',
    description: 'Full Multi-stage Filter and Membrane Overhaul',
    amount: 200000, // ₹2,000 in paise
    currency: 'inr',
    isRecurring: false,
  },
  PumpRepair: {
    label: '⚙️ Pump / Sensor Repair',
    description: 'Submersible Pump Diagnostic & Repair',
    amount: 75000, // ₹750 in paise
    currency: 'inr',
    isRecurring: false,
  },
  SensorReplacement: {
    label: '🔌 Sensor Replacement & Tuning',
    description: 'Ultrasonic / Turbidity Sensor Calibration & Replacement',
    amount: 120000, // ₹1,200 in paise
    currency: 'inr',
    isRecurring: false,
  },
  EmergencyService: {
    label: '🚨 Emergency Service Call-out',
    description: 'Priority Emergency Call-out within 4 Hours',
    amount: 49900, // ₹499 in paise
    currency: 'inr',
    isRecurring: false,
  },
  EmergencyCritical: {
    label: '🚨 Critical SOS Emergency Service',
    description: 'Urgent SOS 60-minute Emergency Call-out',
    amount: 99900, // ₹999 in paise
    currency: 'inr',
    isRecurring: false,
  },
  Installation: {
    label: '🏠 Installation',
    description: 'Full SUOWMRS System Installation & Onboarding',
    amount: 500000, // ₹5,000
    currency: 'inr',
    isRecurring: false,
  },
};

// ── Create or retrieve Stripe customer ──
export const getOrCreateStripeCustomer = async (user) => {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.fullName,
    metadata: { userId: user._id.toString() },
  });
  return customer.id;
};

// ── Create a one-time PaymentIntent ──
export const createPaymentIntent = async ({ amount, currency = 'inr', metadata = {}, customerId }) => {
  const intentData = {
    amount,
    currency,
    metadata,
    payment_method_types: ['card'], // card-only checkout (UPI / net-banking disabled for now)
  };
  if (customerId) intentData.customer = customerId;
  return stripe.paymentIntents.create(intentData);
};

// ── Create a Stripe Subscription (AMC) ──
export const createSubscription = async ({ customerId, priceId, metadata = {} }) => {
  // For test mode without real Stripe price IDs, create an ephemeral price
  let resolvedPriceId = priceId;

  // If price is a placeholder, create an inline price for demo purposes
  if (!priceId || priceId.includes('placeholder')) {
    const planKey = metadata.planType;
    const plan = PLANS[planKey];
    if (!plan) throw new Error(`Invalid plan: ${planKey}`);
    const price = await stripe.prices.create({
      unit_amount: plan.amount,
      currency: plan.currency,
      recurring: { interval: plan.interval },
      product_data: { name: plan.description },
    });
    resolvedPriceId = price.id;
  }

  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: resolvedPriceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription', payment_method_types: ['card'] },
    expand: ['latest_invoice.payment_intent'],
    metadata,
  });
};

// ── Cancel a subscription ──
export const cancelSubscription = async (subscriptionId) => {
  return stripe.subscriptions.cancel(subscriptionId);
};

// ── Retrieve a subscription ──
export const retrieveSubscription = async (subscriptionId) => {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['latest_invoice'],
  });
};

// ── Construct Stripe webhook event ──
export const constructWebhookEvent = (payload, sig) => {
  return stripe.webhooks.constructEvent(
    payload,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder'
  );
};

// ── Retrieve payment intent ──
export const retrievePaymentIntent = async (id) => {
  return stripe.paymentIntents.retrieve(id);
};

export default stripe;
