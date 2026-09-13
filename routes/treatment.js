import express from 'express';
import Treatment from '../models/Treatment.js';

const router = express.Router();

// GET /api/treatment/current
router.get('/current', async (req, res) => {
  try {
    const latest = await Treatment.findOne().sort({ timestamp: -1 });
    if (!latest) {
      // Return sensible defaults when no treatment record exists yet
      return res.json({
        storedWater: 8500,
        treatedWater: 6200,
        availableForReuse: 5900,
        qualityStatus: 'good',
        treatmentEfficiency: 73,
        allocations: {
          gardening: 1800,
          cleaning: 1200,
          irrigation: 1500,
          construction: 900,
          industrial: 500,
        },
        timestamp: new Date(),
      });
    }
    res.json(latest);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch treatment data' });
  }
});

export default router;
