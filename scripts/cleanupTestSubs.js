// One-off maintenance helper: cancel stale `payment_pending` subscriptions left behind by
// abandoned Stripe checkouts (older than 1 hour). Usage: node scripts/cleanupTestSubs.js
import 'dotenv/config';
import mongoose from 'mongoose';
import Subscription from '../models/Subscription.js';
import { cancelSubscription } from '../services/stripeService.js';

await mongoose.connect(process.env.MONGO_URI);
const cutoff = new Date(Date.now() - 60 * 60 * 1000);
const stale = await Subscription.find({ status: 'payment_pending', updatedAt: { $lt: cutoff } });
for (const s of stale) {
  if (s.stripeSubscriptionId && !s.stripeSubscriptionId.includes('placeholder')) {
    try { await cancelSubscription(s.stripeSubscriptionId); } catch (e) { console.warn('Stripe cancel failed:', e.message); }
  }
  s.status = 'cancelled';
  s.cancelledAt = new Date();
  await s.save();
  console.log('Cancelled stale pending subscription', s._id.toString(), s.plan);
}
console.log(`Done — ${stale.length} stale subscription(s) cleaned.`);
await mongoose.disconnect();
