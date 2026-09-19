import express from 'express';
import ServicePlan from '../models/ServicePlan.js';
import { authenticate, requireAdmin } from './auth.js';

const router = express.Router();

// ── Default seed plans (called once if DB is empty) ──
const DEFAULT_PLANS = [
  { key: 'BasicAMC',          label: 'Basic AMC',                   icon: '🔧', description: 'Annual Maintenance Contract — Basic annual coverage',      amount: 149900, isRecurring: true,  interval: 'year',     category: 'amc',       sortOrder: 1, isActive: true, features: ['1 annual maintenance visit', 'System health check', 'Sensor calibration', 'Email support'] },
  { key: 'StandardAMC',       label: 'Standard AMC',                icon: '⭐', description: 'Annual Maintenance Contract — Comprehensive coverage',    amount: 249900, isRecurring: true,  interval: 'year',     category: 'amc',       sortOrder: 2, isActive: true, features: ['2 maintenance visits/year', 'Filter inspection', 'Priority support', 'Remote monitoring', 'SMS + email alerts'] },
  { key: 'PremiumAMC',        label: 'Premium AMC',                 icon: '💎', description: 'Annual Maintenance Contract — Premium priority service',   amount: 399900, isRecurring: true,  interval: 'year',     category: 'amc',       sortOrder: 3, isActive: true, features: ['4 maintenance visits/year', 'Filter replacement included', '24/7 emergency response', 'Smart monitoring included', 'Dedicated technician'] },
  { key: 'SmartMonitoring',   label: 'Smart Monitoring',            icon: '📱', description: 'IoT sensor live streaming & AI flood prediction access',  amount: 9900,   isRecurring: true,  interval: 'month',    category: 'monitoring', sortOrder: 4, isActive: true, features: ['Real-time IoT sensor telemetry', 'AI flood risk alerts', 'SMS + WhatsApp alerts', 'Data analytics export'] },
  { key: 'FilterBasic',       label: 'Sediment Filter Replacement', icon: '💧', description: 'Basic sediment and pre-filter cartridge replacement',     amount: 50000,  isRecurring: false, interval: 'one-time', category: 'service',   sortOrder: 5, isActive: true, features: ['High-density sediment filter', 'Debris flush', 'Technician inspection'] },
  { key: 'FilterReplacement', label: 'Standard Filter Replacement', icon: '💧', description: 'Dual-stage carbon block and particulate filter service',  amount: 100000, isRecurring: false, interval: 'one-time', category: 'service',   sortOrder: 6, isActive: true, features: ['Activated carbon block', 'Flow rate calibration', '30-day warranty'] },
  { key: 'FilterComplete',    label: 'Complete RO/UV Filter Kit',   icon: '💧', description: 'Full membrane, carbon & UV sterilization filter overhaul', amount: 200000, isRecurring: false, interval: 'one-time', category: 'service',   sortOrder: 7, isActive: true, features: ['Complete filter kit', 'Deep sanitization', '60-day replacement warranty'] },
  { key: 'PumpRepair',        label: 'Pump / Sensor Repair',        icon: '⚙️', description: 'Submersible pump motor diagnostic, cleaning & repair',    amount: 75000,  isRecurring: false, interval: 'one-time', category: 'service',   sortOrder: 8, isActive: true, features: ['Motor impeller diagnostic', 'Electrical check', 'Cleaning & repair', '30-day warranty'] },
  { key: 'SensorReplacement', label: 'Sensor Replacement & Tuning', icon: '🔌', description: 'Ultrasonic water level or turbidity sensor replacement', amount: 120000, isRecurring: false, interval: 'one-time', category: 'service',   sortOrder: 9, isActive: true, features: ['Genuine ultrasonic/turbidity sensor', 'Zero-point calibration', 'Telemetry sync'] },
  { key: 'EmergencyService',  label: 'Emergency Service Call-out',  icon: '🚨', description: 'Rapid dispatch technician visit within 4 hours',          amount: 49900,  isRecurring: false, interval: 'one-time', category: 'emergency', sortOrder: 10, isActive: true, features: ['4-hour on-site dispatch', 'Urgent leak/clog containment', 'Priority parts allocation'] },
  { key: 'EmergencyCritical', label: 'Critical SOS Emergency',      icon: '🚨', description: 'Immediate emergency rescue visit within 60 minutes',       amount: 99900,  isRecurring: false, interval: 'one-time', category: 'emergency', sortOrder: 11, isActive: true, features: ['1-hour rapid response team', 'Emergency pumping kit', 'Senior technician team'] },
  { key: 'Installation',      label: 'SUOWMRS Hardware Installation', icon: '🏠', description: 'Full household system installation & onboarding',        amount: 500000, isRecurring: false, interval: 'one-time', category: 'service',   sortOrder: 12, isActive: true, features: ['Site survey & tank fitting', 'Complete hardware mounting', 'Initial sensor calibration', '1-year Basic AMC included'] },
];

// ── Seed / Sync default plans ──
const seedDefaultPlans = async () => {
  for (const p of DEFAULT_PLANS) {
    await ServicePlan.findOneAndUpdate(
      { key: p.key },
      { $setOnInsert: p },
      { upsert: true }
    );
  }
  console.log('✅ Service plans synced');
};
// Seed on first import
seedDefaultPlans().catch(console.error);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/plans — All plans (public, for pricing display)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/plans', async (req, res) => {
  try {
    const plans = await ServicePlan.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 });
    const formatted = plans.map(p => ({
      _id: p._id,
      key: p.key,
      label: p.label,
      icon: p.icon,
      description: p.description,
      amount: p.amount,
      amountDisplay: `₹${(p.amount / 100).toLocaleString('en-IN')}`,
      currency: p.currency,
      isRecurring: p.isRecurring,
      interval: p.interval,
      category: p.category,
      sortOrder: p.sortOrder,
      features: p.features,
    }));
    res.json({ plans: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/plans/all — All plans including inactive (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/plans/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const plans = await ServicePlan.find().sort({ sortOrder: 1, createdAt: 1 });
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/plans — Create new plan (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/plans', authenticate, requireAdmin, async (req, res) => {
  try {
    const { key, label, icon, description, amount, isRecurring, interval, category, features, sortOrder } = req.body;
    if (!key || !label || !amount) return res.status(400).json({ error: 'key, label, and amount are required.' });

    // Check for duplicate key
    const existing = await ServicePlan.findOne({ key });
    if (existing) return res.status(409).json({ error: `A plan with key "${key}" already exists.` });

    const plan = new ServicePlan({
      key: key.trim(),
      label: label.trim(),
      icon: icon || '🔧',
      description: description?.trim() || '',
      amount: Math.round(amount), // already in paise
      isRecurring: Boolean(isRecurring),
      interval: interval || 'one-time',
      category: category || 'service',
      features: Array.isArray(features) ? features.filter(Boolean) : [],
      sortOrder: sortOrder || 99,
      isActive: true,
    });
    await plan.save();
    res.status(201).json({ message: 'Plan created successfully.', plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/plans/:id — Update plan (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/plans/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { label, icon, description, amount, isRecurring, interval, category, features, sortOrder, isActive } = req.body;
    const update = {};
    if (label !== undefined)       update.label       = label.trim();
    if (icon !== undefined)        update.icon        = icon;
    if (description !== undefined) update.description = description.trim();
    if (amount !== undefined)      update.amount      = Math.round(amount);
    if (isRecurring !== undefined) update.isRecurring = Boolean(isRecurring);
    if (interval !== undefined)    update.interval    = interval;
    if (category !== undefined)    update.category    = category;
    if (features !== undefined)    update.features    = Array.isArray(features) ? features.filter(Boolean) : [];
    if (sortOrder !== undefined)   update.sortOrder   = sortOrder;
    if (isActive !== undefined)    update.isActive    = Boolean(isActive);

    const plan = await ServicePlan.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });
    res.json({ message: 'Plan updated successfully.', plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/plans/:id — Delete plan (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/plans/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const plan = await ServicePlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });
    res.json({ message: `Plan "${plan.label}" deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
