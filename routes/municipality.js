import express from 'express';
import SystemNode from '../models/SystemNode.js';
import Complaint from '../models/Complaint.js';
import Alert from '../models/Alert.js';
import Storage from '../models/Storage.js';
import { getMunicipalityOverviewStats } from '../services/municipalityService.js';
import { setManualValveOverride } from '../services/sensorSimulator.js';
import { io } from '../server.js';

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

// ───────── POST /api/municipality/divert (Trigger emergency flood diversion) ─────────
router.post('/divert', async (req, res) => {
  try {
    const { systemId } = req.body;
    if (!systemId) {
      return res.status(400).json({ error: 'systemId is required for flood diversion.' });
    }

    const node = await SystemNode.findOne({ systemId });
    if (!node) {
      return res.status(404).json({ error: `System node ${systemId} not found.` });
    }

    // Check if diversion is appropriate
    if (node.storageLevel >= 95) {
      return res.status(400).json({
        error: `Diversion rejected: Cistern buffer at ${node.systemId} is at ${node.storageLevel.toFixed(0)}% capacity. High risk of reservoir back-pressure.`,
      });
    }

    // Actuate the diverter valve
    setManualValveOverride('OPEN');

    // Reduce water level by relieving flood volume into storage
    const reduction = Math.min(node.waterLevel, Math.floor(Math.random() * 15 + 18));
    node.waterLevel = Math.max(25, node.waterLevel - reduction);
    node.storageLevel = Math.min(94, node.storageLevel + Math.floor(reduction * 0.8));
    node.status = node.waterLevel >= 75 ? 'Warning' : 'Normal';
    node.lastUpdated = new Date();
    await node.save();

    // Log critical action alert
    await Alert.create({
      type: 'warning',
      message: `EMERGENCY DIVERSION: Diverter valve opened for ${node.systemId} (${node.location}). Water level reduced to ${node.waterLevel.toFixed(1)}%.`,
      messageKey: 'alert_diversion_active',
      level: node.waterLevel,
    });

    // Update central storage record
    await Storage.create({
      currentVolume: Math.min(9400, 7200 + reduction * 20),
      fillPercentage: Math.min(94, 72 + reduction * 0.2),
      valveStatus: 'OPEN',
      inFlowRate: 220,
      isManualOverride: true,
    });

    if (io) {
      io.emit('municipality:divert', {
        systemId: node.systemId,
        node,
        message: `Emergency water diversion active for ${node.systemId}`,
      });
      io.emit('storage:update', {
        valveStatus: 'OPEN',
        inFlowRate: 220,
        isManualOverride: true,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: `Emergency flood diversion successfully activated for ${node.systemId}.`,
      node,
    });
  } catch (err) {
    console.error('Failed to trigger flood diversion:', err);
    res.status(500).json({ error: 'Failed to execute emergency flood diversion.' });
  }
});

export default router;
