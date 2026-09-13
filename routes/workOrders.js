import express from 'express';
import WorkOrder from '../models/WorkOrder.js';

const router = express.Router();

// Helper to capitalize words
const toTitleCase = (str = '') => {
  if (!str) return str;
  const s = str.toLowerCase();
  if (s === 'in-progress' || s === 'in progress') return 'In Progress';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// GET /api/work-orders — List with optional status/priority filter
router.get('/', async (req, res) => {
  try {
    const { status, priority } = req.query;
    const filter = {};
    if (status && status !== 'All') {
      filter.status = new RegExp(`^${status.replace('-', ' ')}$`, 'i');
    }
    if (priority && priority !== 'All') {
      filter.priority = new RegExp(`^${priority}$`, 'i');
    }

    const orders = await WorkOrder.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch work orders' });
  }
});

// POST /api/work-orders — Create new work order
router.post('/', async (req, res) => {
  try {
    const {
      title,
      component,
      description,
      issueDescription,
      priority = 'Medium',
      assignedTechnician,
      scheduledDate,
      notes,
      maintenanceNotes,
    } = req.body;

    const desc = (issueDescription || description || 'Hardware maintenance ticket').trim();
    if (!title || !component) {
      return res.status(400).json({ error: 'Title and component are required.' });
    }

    const count = await WorkOrder.countDocuments();
    const orderNumber = `WO-2026-${String(count + 1).padStart(3, '0')}`;

    const normalizedPriority = toTitleCase(priority) || 'Medium';

    const newOrder = await WorkOrder.create({
      orderNumber,
      title: title.trim(),
      component: component.trim(),
      issueDescription: desc,
      priority: ['Low', 'Medium', 'High', 'Critical'].includes(normalizedPriority) ? normalizedPriority : 'Medium',
      status: 'Pending',
      assignedTechnician: (assignedTechnician || 'Rajesh Kumar (TECH-8842)').trim(),
      scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      maintenanceNotes: (maintenanceNotes || notes)
        ? [{ note: maintenanceNotes || notes, author: assignedTechnician || 'Technician', createdAt: new Date() }]
        : [],
    });

    res.status(201).json({
      success: true,
      message: `Work Order ${orderNumber} created successfully.`,
      workOrder: newOrder,
    });
  } catch (err) {
    console.error('[Create Work Order Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to create work order' });
  }
});

// PATCH /api/work-orders/:id — Update status, priority or append notes
router.patch('/:id', async (req, res) => {
  try {
    const { status, priority, newNote, author } = req.body;
    const order = await WorkOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    if (status) {
      const normStatus = toTitleCase(status);
      order.status = normStatus;
      if (normStatus === 'Completed') {
        order.completedAt = new Date();
      }
    }
    if (priority) order.priority = toTitleCase(priority);

    if (newNote && newNote.trim()) {
      order.maintenanceNotes.push({
        note: newNote.trim(),
        author: author || 'Technician',
        createdAt: new Date(),
      });
    }

    await order.save();

    res.json({
      success: true,
      message: 'Work order updated successfully.',
      workOrder: order,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update work order' });
  }
});

export default router;
