import express from 'express';
import Treatment from '../models/Treatment.js';
import { io } from '../server.js';

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
        filtrationStatus: 'ACTIVE',
        gardeningSession: {
          active: false,
          flowRate: 0,
          volumeDispensed: 1800,
          soilMoisture: 52,
        },
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

// POST /api/treatment/filtration — Toggle filtration mode (Normally ON, Maintenance only)
router.post('/filtration', async (req, res) => {
  try {
    const { status, userRole } = req.body; // 'ACTIVE' | 'MAINTENANCE_PAUSED'

    if (!['ACTIVE', 'MAINTENANCE_PAUSED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be ACTIVE or MAINTENANCE_PAUSED.' });
    }

    // Strictly enforce role-based security: Residents cannot turn filtration OFF
    if (status === 'MAINTENANCE_PAUSED' && userRole === 'Resident') {
      return res.status(403).json({
        error: 'Security Policy: Residents are not authorized to pause water filtration. Technician or Admin credentials required.',
      });
    }

    const latest = await Treatment.findOne().sort({ timestamp: -1 });

    const updatedRecord = await Treatment.create({
      storedWater: latest?.storedWater || 8500,
      treatedWater: latest?.treatedWater || 6200,
      availableForReuse: latest?.availableForReuse || 5900,
      qualityStatus: status === 'ACTIVE' ? 'good' : 'fair',
      treatmentEfficiency: status === 'ACTIVE' ? (latest?.treatmentEfficiency || 73) : 0,
      allocations: latest?.allocations || {
        gardening: 1800,
        cleaning: 1200,
        irrigation: 1500,
        construction: 900,
        industrial: 500,
      },
      filtrationStatus: status,
      gardeningSession: latest?.gardeningSession || {
        active: false,
        flowRate: 0,
        volumeDispensed: 1800,
        soilMoisture: 52,
      },
    });

    if (io) {
      io.emit('treatment:filtration', {
        filtrationStatus: status,
        updatedAt: updatedRecord.timestamp,
      });
      io.emit('treatment:update', updatedRecord);
    }

    res.json({
      success: true,
      message: status === 'ACTIVE'
        ? 'FILTRATION ACTIVE — System Healthy'
        : 'MAINTENANCE MODE — Filtration Paused for Servicing',
      treatment: updatedRecord,
    });
  } catch (err) {
    console.error('Failed to update filtration status:', err);
    res.status(500).json({ error: 'Failed to toggle filtration status.' });
  }
});

// POST /api/treatment/gardening — Start / Stop Gardening Reuse Dispenser
router.post('/gardening', async (req, res) => {
  try {
    const { action, volume = 200 } = req.body; // 'START' | 'STOP'
    const latest = await Treatment.findOne().sort({ timestamp: -1 });

    let currentAvailable = latest?.availableForReuse || 5900;
    let allocations = latest?.allocations ? { ...latest.allocations } : {
      gardening: 1800,
      cleaning: 1200,
      irrigation: 1500,
      construction: 900,
      industrial: 500,
    };

    const isStarting = action === 'START';

    if (isStarting) {
      const volNum = parseInt(volume, 10) || 200;
      currentAvailable = Math.max(0, currentAvailable - volNum);
      allocations.gardening = (allocations.gardening || 1800) + volNum;
    }

    const updated = await Treatment.create({
      storedWater: latest?.storedWater || 8500,
      treatedWater: latest?.treatedWater || 6200,
      availableForReuse: currentAvailable,
      qualityStatus: latest?.qualityStatus || 'good',
      treatmentEfficiency: latest?.treatmentEfficiency || 73,
      allocations,
      filtrationStatus: latest?.filtrationStatus || 'ACTIVE',
      gardeningSession: {
        active: isStarting,
        flowRate: isStarting ? 45 : 0,
        volumeDispensed: isStarting ? (latest?.gardeningSession?.volumeDispensed || 1800) + (parseInt(volume, 10) || 200) : (latest?.gardeningSession?.volumeDispensed || 1800),
        soilMoisture: isStarting ? 68 : 54,
      },
    });

    if (io) {
      io.emit('treatment:gardening', {
        gardeningSession: updated.gardeningSession,
        allocations: updated.allocations,
        availableForReuse: updated.availableForReuse,
      });
      io.emit('treatment:update', updated);
    }

    res.json({
      success: true,
      message: isStarting
        ? `Gardening water dispenser active: ${volume}L scheduled at 45 L/min.`
        : 'Gardening water dispenser shut off.',
      treatment: updated,
    });
  } catch (err) {
    console.error('Failed to toggle gardening reuse:', err);
    res.status(500).json({ error: 'Failed to update gardening water reuse.' });
  }
});

export default router;
