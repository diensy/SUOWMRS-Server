import express from 'express';
import Storage from '../models/Storage.js';

const router = express.Router();

// GET /api/storage/current
router.get('/current', async (req, res) => {
  try {
    const latest = await Storage.findOne().sort({ timestamp: -1 });
    if (!latest) {
      return res.json({
        totalCapacity: 10000,
        currentVolume: 7200,
        fillPercentage: 72,
        valveStatus: 'STANDBY',
        inFlowRate: 0,
        timestamp: new Date(),
      });
    }
    res.json(latest);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch storage status' });
  }
});

// POST /api/storage/valve  — Manual valve override
router.post('/valve', async (req, res) => {
  try {
    const { action } = req.body; // 'OPEN' | 'STANDBY'
    if (!['OPEN', 'STANDBY'].includes(action)) {
      return res.status(400).json({ error: 'Invalid valve action. Use OPEN or STANDBY.' });
    }

    const latest = await Storage.findOne().sort({ timestamp: -1 });
    const newRecord = await Storage.create({
      totalCapacity: latest?.totalCapacity || 10000,
      currentVolume: latest?.currentVolume || 7200,
      fillPercentage: latest?.fillPercentage || 72,
      valveStatus: action,
      inFlowRate: action === 'OPEN' ? 180 : 0,
      isManualOverride: true,
    });

    res.json({
      success: true,
      message: `Valve manually set to ${action}`,
      storage: newRecord,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle valve' });
  }
});

export default router;
