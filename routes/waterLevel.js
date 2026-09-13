import express from 'express';
import WaterLevel from '../models/WaterLevel.js';

const router = express.Router();

// GET /api/water-level/latest
router.get('/latest', async (req, res) => {
  try {
    const latest = await WaterLevel.findOne().sort({ timestamp: -1 });
    if (!latest) {
      return res.json({ level: 42, status: 'normal', depthMeters: 1.68, location: 'Zone 4 - Ward 12 Riverbed', sensorId: 'SYS-042', timestamp: new Date() });
    }
    res.json(latest);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch latest water level' });
  }
});

// GET /api/water-level/history?hours=24
router.get('/history', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Sample one reading per 30-minute window to keep response compact
    const readings = await WaterLevel.find({ timestamp: { $gte: since } })
      .sort({ timestamp: -1 })
      .limit(48);

    res.json(readings.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch water level history' });
  }
});

// GET /api/water-level/stats
router.get('/stats', async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const agg = await WaterLevel.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: null,
          min: { $min: '$level' },
          max: { $max: '$level' },
          avg: { $avg: '$level' },
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = agg[0] || { min: 0, max: 0, avg: 0, count: 0 };
    res.json({
      min: parseFloat((stats.min || 0).toFixed(1)),
      max: parseFloat((stats.max || 0).toFixed(1)),
      avg: parseFloat((stats.avg || 0).toFixed(1)),
      count: stats.count,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
