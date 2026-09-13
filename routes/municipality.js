import express from 'express';
import SystemNode from '../models/SystemNode.js';
import Complaint from '../models/Complaint.js';
import Alert from '../models/Alert.js';
import Storage from '../models/Storage.js';
import { getMunicipalityOverviewStats } from '../services/municipalityService.js';

const router = express.Router();

// ───────── GET /api/municipality/overview ─────────
router.get('/overview', async (req, res) => {
  try {
    const stats = await getMunicipalityOverviewStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch municipality overview stats.' });
  }
});

// ───────── GET /api/municipality/systems (Table view with search, filter, pagination) ─────────
router.get('/systems', async (req, res) => {
  try {
    const { status = 'All', search = '', page = 1, limit = 10 } = req.query;

    const query = {};
    if (status !== 'All') {
      if (status === 'Offline') {
        query.deviceStatus = 'Offline';
      } else {
        query.status = status;
      }
    }

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { systemId: searchRegex },
        { ward: searchRegex },
        { location: searchRegex },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await SystemNode.countDocuments(query);
    const systems = await SystemNode.find(query)
      .sort({ systemId: 1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      systems,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch municipality systems list.' });
  }
});

// ───────── GET /api/municipality/map (All 128 nodes for GIS Map) ─────────
router.get('/map', async (req, res) => {
  try {
    const nodes = await SystemNode.find().select('systemId ward location coordinates waterLevel status storageLevel deviceStatus lastUpdated');
    res.json(nodes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch GIS map markers.' });
  }
});

// ───────── GET /api/municipality/emergency ─────────
router.get('/emergency', async (req, res) => {
  try {
    const criticalNodes = await SystemNode.find({
      $or: [{ status: 'Critical' }, { status: 'Warning' }, { waterLevel: { $gte: 75 } }]
    }).sort({ waterLevel: -1 });

    const criticalComplaints = await Complaint.find({
      priority: { $in: ['Urgent', 'High'] },
      status: { $ne: 'Closed' }
    }).sort({ priority: -1, createdAt: -1 });

    const recentCriticalAlerts = await Alert.find({
      type: { $in: ['critical', 'danger'] }
    }).sort({ createdAt: -1 }).limit(10);

    const storage = await Storage.findOne().sort({ updatedAt: -1 });

    res.json({
      criticalSystemsCount: criticalNodes.length,
      criticalNodes,
      criticalComplaints,
      recentAlerts: recentCriticalAlerts,
      storageStatus: storage,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch emergency monitoring data.' });
  }
});

export default router;
