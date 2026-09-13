import express from 'express';

const router = express.Router();

// Healthcheck endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'SUOWMRS API',
    version: '1.0.0',
    phase: 'Phase 0 - Project Setup & Design System',
    timestamp: new Date().toISOString(),
  });
});

// System info
router.get('/info', (req, res) => {
  res.json({
    name: 'Smart Underground Overflow & Water Monitoring / Reuse System (SUOWMRS)',
    blueprintPhases: [
      { phase: 0, title: 'Project Setup & Design System', status: 'Completed' },
      { phase: 1, title: 'Live Water-Level Monitoring', status: 'Upcoming' },
      { phase: 2, title: 'Warning and Notifications', status: 'Upcoming' },
      { phase: 3, title: 'Automatic Valve & Storage', status: 'Upcoming' },
      { phase: 4, title: 'Water Treatment and Reuse', status: 'Upcoming' },
      { phase: 5, title: 'Maintenance System', status: 'Upcoming' },
      { phase: 6, title: 'Central Municipality Dashboard', status: 'Upcoming' },
      { phase: 7, title: 'AI Flood Prediction', status: 'Upcoming' },
    ],
  });
});

export default router;
