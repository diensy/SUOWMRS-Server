import express from 'express';
import {
  getLiveFloodPrediction,
  getObservedVsPredictedCurve,
  getWardRiskPredictions,
  executeEarlyAction,
  getEmpiricalAccuracyMetrics,
} from '../services/predictionEngine.js';
import { getCurrentWeather } from '../services/weatherService.js';
import { getHistoricalDataset } from '../services/datasetService.js';
import PredictionRecord from '../models/PredictionRecord.js';

const router = express.Router();

// ───────── GET /api/prediction/current ─────────
router.get('/current', async (req, res) => {
  try {
    const prediction = await getLiveFloodPrediction();
    res.json(prediction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve live flood prediction.' });
  }
});

// ───────── GET /api/prediction/forecast-trend ─────────
router.get('/forecast-trend', async (req, res) => {
  try {
    const trend = await getObservedVsPredictedCurve();
    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve forecast trend curve.' });
  }
});

// ───────── GET /api/prediction/wards ─────────
router.get('/wards', async (req, res) => {
  try {
    const wards = await getWardRiskPredictions();
    res.json(wards);
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate ward risk predictions.' });
  }
});

// ───────── GET /api/prediction/weather (Phase 7.2) ─────────
router.get('/weather', async (req, res) => {
  try {
    const weather = await getCurrentWeather();
    res.json(weather);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch weather telemetry.' });
  }
});

// ───────── GET /api/prediction/dataset (Phase 7.1) ─────────
router.get('/dataset', async (req, res) => {
  try {
    const { hours = 24, ward, limit = 100 } = req.query;
    const dataset = await getHistoricalDataset({
      hours: Number(hours),
      ward,
      limit: Number(limit),
    });
    res.json(dataset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch historical telemetry dataset.' });
  }
});

// ───────── GET /api/prediction/accuracy (Phase 7.8) ─────────
router.get('/accuracy', async (req, res) => {
  try {
    const metrics = await getEmpiricalAccuracyMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve empirical accuracy metrics.' });
  }
});

// ───────── GET /api/prediction/history (Phase 7.8) ─────────
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 15, riskLevel = 'All', status = 'All' } = req.query;
    const filter = {};
    if (riskLevel !== 'All') filter.riskLevel = riskLevel;
    if (status !== 'All') filter.classification = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      PredictionRecord.find(filter).sort({ timestamp: -1 }).skip(skip).limit(Number(limit)).lean(),
      PredictionRecord.countDocuments(filter),
    ]);

    res.json({
      records,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve prediction history records.' });
  }
});

// ───────── POST /api/prediction/action/dispatch (Phase 7.7) ─────────
router.post('/action/dispatch', async (req, res) => {
  try {
    const { actionType, ward = 'Ward 12', details, technicianName } = req.body;
    if (!actionType || !details) {
      return res.status(400).json({ error: 'Action type and details are required.' });
    }

    const result = await executeEarlyAction({ actionType, ward, details, technicianName });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to dispatch early action.' });
  }
});

export default router;
