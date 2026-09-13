/**
 * SUOWMRS Sensor Simulator Service
 * Generates realistic water level telemetry every 5 seconds.
 * Runs threshold engine, saves to MongoDB, and broadcasts via Socket.io.
 */

import WaterLevel from '../models/WaterLevel.js';
import Alert from '../models/Alert.js';
import Storage from '../models/Storage.js';
import Treatment from '../models/Treatment.js';

let io = null;
let simulatorInterval = null;
let currentLevel = 42;
let trend = 1; // +1 rising, -1 falling
let lastStatus = 'normal';
let manualValveStatus = null; // null (automatic), 'OPEN', 'STANDBY'

const TANK_CAPACITY = 10000; // litres
const FLOW_RATE_PER_PERCENT = 40; // litres per % of water level

export const setManualValveOverride = (action) => {
  manualValveStatus = action;
};

export const getManualValveStatus = () => manualValveStatus;

export const initSimulator = (socketIo) => {
  io = socketIo;
  console.log('[Simulator] Sensor telemetry engine initialized.');
  startSimulator();
};

const getStatus = (level) => {
  if (level < 50) return 'normal';
  if (level < 75) return 'warning';
  if (level < 90) return 'danger';
  return 'critical';
};

const getStatusMessage = (status, level) => {
  const messages = {
    normal: `Water level normal at ${level.toFixed(1)}%. Drainage flow stable.`,
    warning: `Caution: Rising water level at ${level.toFixed(1)}%. Monitoring closely.`,
    danger: `HIGH RISK: Water level at ${level.toFixed(1)}%! Diverter valve auto-opened.`,
    critical: `CRITICAL FLOOD ALERT: Water level at ${level.toFixed(1)}%! Emergency protocol active.`,
  };
  return messages[status];
};

const startSimulator = () => {
  if (simulatorInterval) clearInterval(simulatorInterval);

  simulatorInterval = setInterval(async () => {
    // Determine valve diversion state
    const isManual = manualValveStatus !== null;
    const shouldOpenValve = isManual ? (manualValveStatus === 'OPEN') : (currentLevel >= 75);

    if (shouldOpenValve) {
      // Diverter valve actively draining floodwater into reservoir
      currentLevel = Math.max(12, currentLevel - (Math.random() * 2.5 + 1.5));
      trend = -1;
    } else {
      // Normal rainwater inflow fluctuation
      const change = (Math.random() * 4 - 1) * trend;
      currentLevel = Math.max(10, Math.min(98, currentLevel + change));
      if (currentLevel >= 92) trend = -1;
      if (currentLevel <= 18) trend = 1;
    }

    const status = getStatus(currentLevel);
    const depthMeters = parseFloat((currentLevel * 0.04).toFixed(2));

    // 1. Save water level reading to MongoDB
    try {
      const reading = await WaterLevel.create({
        level: parseFloat(currentLevel.toFixed(2)),
        status,
        depthMeters,
      });

      // 2. Emit live water level event to all clients
      if (io) {
        io.emit('water:level', {
          level: reading.level,
          status: reading.status,
          depthMeters: reading.depthMeters,
          location: reading.location,
          sensorId: reading.sensorId,
          timestamp: reading.timestamp,
        });
      }

      // 3. If status changed → create alert and emit alert event
      if (status !== lastStatus) {
        const message = getStatusMessage(status, currentLevel);

        const alert = await Alert.create({
          type: status,
          message,
          messageKey: `alert_${status}`,
          level: parseFloat(currentLevel.toFixed(2)),
        });

        if (io) {
          io.emit('water:alert', {
            id: alert._id,
            type: alert.type,
            message: alert.message,
            messageKey: alert.messageKey,
            level: alert.level,
            createdAt: alert.createdAt,
          });
        }

        lastStatus = status;
      }

      // 4. Update storage based on water level and manual override
      const inFlowRate = shouldOpenValve ? parseFloat((Math.max(60, currentLevel * 2.5)).toFixed(1)) : 0;

      const latestStorage = await Storage.findOne().sort({ timestamp: -1 });
      let currentVolume = latestStorage ? latestStorage.currentVolume : 7200;

      if (shouldOpenValve && currentVolume < TANK_CAPACITY) {
        // Diversion actively fills underground cistern
        currentVolume = Math.min(TANK_CAPACITY, currentVolume + (inFlowRate * (5 / 60) * 3));
      }

      const fillPercentage = parseFloat(((currentVolume / TANK_CAPACITY) * 100).toFixed(1));

      const storageRecord = await Storage.create({
        currentVolume: parseFloat(currentVolume.toFixed(0)),
        fillPercentage,
        valveStatus: shouldOpenValve ? 'OPEN' : 'STANDBY',
        inFlowRate,
        isManualOverride: isManual,
      });

      if (io) {
        io.emit('storage:update', {
          currentVolume: storageRecord.currentVolume,
          fillPercentage: storageRecord.fillPercentage,
          valveStatus: storageRecord.valveStatus,
          inFlowRate: storageRecord.inFlowRate,
          totalCapacity: storageRecord.totalCapacity,
          timestamp: storageRecord.timestamp,
        });
      }

    } catch (err) {
      // MongoDB might not be connected — continue silently
      if (io) {
        io.emit('water:level', {
          level: parseFloat(currentLevel.toFixed(2)),
          status,
          depthMeters,
          location: 'Zone 4 - Ward 12 Riverbed',
          sensorId: 'SYS-042',
          timestamp: new Date().toISOString(),
          _simulationOnly: true,
        });

        if (status !== lastStatus) {
          io.emit('water:alert', {
            type: status,
            message: getStatusMessage(status, currentLevel),
            level: parseFloat(currentLevel.toFixed(2)),
            createdAt: new Date().toISOString(),
          });
          lastStatus = status;
        }
      }
    }
  }, 5000);
};

export const stopSimulator = () => {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    console.log('[Simulator] Sensor telemetry engine stopped.');
  }
};
