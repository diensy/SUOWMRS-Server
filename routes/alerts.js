import express from 'express';
import Alert from '../models/Alert.js';

const router = express.Router();

// GET /api/alerts?page=1&limit=10
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      Alert.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Alert.countDocuments(),
    ]);

    res.json({ alerts, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/alerts/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Alert.countDocuments({ isRead: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// PATCH /api/alerts/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

// PATCH /api/alerts/mark-all-read
router.patch('/mark-all-read', async (req, res) => {
  try {
    await Alert.updateMany({ isRead: false }, { isRead: true });
    res.json({ message: 'All alerts marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark alerts as read' });
  }
});

export default router;
