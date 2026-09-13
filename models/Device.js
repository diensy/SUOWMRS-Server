import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      default: 'ESP32-UNIT-001',
    },
    name: {
      type: String,
      default: 'Primary Node Telemetry Controller',
    },
    location: {
      type: String,
      default: 'Zone 4 - Ward 12 Riverbed Sump',
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'degraded', 'rebooting'],
      default: 'online',
    },
    wifiSignalDbm: {
      type: Number,
      default: -58,
    },
    wifiQuality: {
      type: String,
      enum: ['Excellent', 'Good', 'Fair', 'Poor'],
      default: 'Excellent',
    },
    ipAddress: {
      type: String,
      default: '192.168.1.142',
    },
    macAddress: {
      type: String,
      default: '30:AE:A4:07:0F:9C',
    },
    firmwareVersion: {
      type: String,
      default: 'v1.0.4-prod',
    },
    uptimeSeconds: {
      type: Number,
      default: 1065600, // ~12 days 8 hours
    },
    sensorUpdateFrequencySec: {
      type: Number,
      default: 5,
    },
    freeHeapBytes: {
      type: Number,
      default: 184320,
    },
    cpuTempCelsius: {
      type: Number,
      default: 38.4,
    },
    pingLatencyMs: {
      type: Number,
      default: 14,
    },
    lastPing: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const Device = mongoose.model('Device', deviceSchema);
export default Device;
