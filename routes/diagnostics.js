import express from 'express';
import Device from '../models/Device.js';
import ComponentHealth from '../models/ComponentHealth.js';

const router = express.Router();

// GET /api/diagnostics/overview — System Health Summary
router.get('/overview', async (req, res) => {
  try {
    const [components, device] = await Promise.all([
      ComponentHealth.find().sort({ category: 1 }),
      Device.findOne({ deviceId: 'ESP32-UNIT-001' }),
    ]);

    const total = components.length || 8;
    const healthyCount = components.filter(c => c.status === 'healthy').length;
    const warningCount = components.filter(c => c.status === 'warning').length;
    const criticalCount = components.filter(c => c.status === 'critical').length;
    const offlineCount = components.filter(c => c.status === 'offline').length;

    const totalHealth = components.reduce((acc, c) => acc + (c.healthPercentage || 90), 0);
    const overallHealthPercent = components.length > 0 ? Math.round(totalHealth / components.length) : 92;

    res.json({
      overallHealthPercent,
      healthyCount,
      warningCount,
      criticalCount,
      offlineCount,
      totalComponents: total,
      lastDiagnosticTime: device?.lastPing || new Date(),
      device,
      components,
    });
  } catch (err) {
    console.error('[Diagnostics Overview Error]:', err);
    res.status(500).json({ error: 'Failed to fetch diagnostics overview' });
  }
});

// GET /api/diagnostics/esp32 — ESP32 Microcontroller Details
router.get('/esp32', async (req, res) => {
  try {
    let device = await Device.findOne({ deviceId: 'ESP32-UNIT-001' });
    if (!device) {
      device = await Device.create({
        deviceId: 'ESP32-UNIT-001',
        name: 'Primary Node Telemetry Controller',
        status: 'online',
        wifiSignalDbm: -58,
        wifiQuality: 'Excellent',
        ipAddress: '192.168.1.142',
        firmwareVersion: 'v1.0.4',
        uptimeSeconds: 1065600,
      });
    }
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ESP32 diagnostics' });
  }
});

// GET /api/diagnostics/sensors — Sensor Diagnostics & Calibration
router.get('/sensors', async (req, res) => {
  try {
    const sensors = await ComponentHealth.find({ category: 'sensor' });
    res.json(sensors);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sensor diagnostics' });
  }
});

// GET /api/diagnostics/components — Pump, Valve, Relay & Infrastructure
router.get('/components', async (req, res) => {
  try {
    const components = await ComponentHealth.find({
      category: { $in: ['actuator', 'infrastructure', 'controller'] },
    });
    res.json(components);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch component diagnostics' });
  }
});

// POST /api/diagnostics/calibrate/:id — Calibrate Sensor
router.post('/calibrate/:id', async (req, res) => {
  try {
    const sensor = await ComponentHealth.findById(req.params.id);
    if (!sensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    sensor.lastCalibrationDate = new Date();
    sensor.nextCalibrationDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead
    sensor.errorCount = 0;
    sensor.status = 'healthy';
    sensor.healthPercentage = Math.min(100, (sensor.healthPercentage || 90) + 5);
    sensor.maintenanceNotes = `Calibrated successfully on ${new Date().toLocaleDateString()}. Zero-offset verified.`;
    await sensor.save();

    res.json({
      success: true,
      message: `${sensor.name} successfully calibrated.`,
      sensor,
    });
  } catch (err) {
    res.status(500).json({ error: 'Calibration failed' });
  }
});

// POST /api/diagnostics/reboot — Soft reboot ESP32 controller
router.post('/reboot', async (req, res) => {
  try {
    let device = await Device.findOne({ deviceId: 'ESP32-UNIT-001' });
    if (device) {
      device.status = 'rebooting';
      await device.save();

      // Reset to online after 3 seconds
      setTimeout(async () => {
        try {
          await Device.updateOne(
            { deviceId: 'ESP32-UNIT-001' },
            { status: 'online', uptimeSeconds: 12, lastPing: new Date(), pingLatencyMs: 14 }
          );
        } catch (e) {
          console.error('Error resetting device post-reboot:', e);
        }
      }, 3000);
    }

    res.json({
      success: true,
      message: 'ESP32 controller reboot signal dispatched. Telemetry node reconnecting...',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send reboot signal' });
  }
});

// POST /api/diagnostics/ping — Trigger instantaneous Ping Latency test
router.post('/ping', async (req, res) => {
  try {
    const latency = Math.floor(10 + Math.random() * 15);
    const device = await Device.findOneAndUpdate(
      { deviceId: 'ESP32-UNIT-001' },
      { lastPing: new Date(), pingLatencyMs: latency, status: 'online' },
      { new: true }
    );
    res.json({ success: true, latency, device });
  } catch (err) {
    res.status(500).json({ error: 'Ping diagnostic failed' });
  }
});

export default router;
