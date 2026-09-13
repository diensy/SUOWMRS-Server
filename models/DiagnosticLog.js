import mongoose from 'mongoose';

const diagnosticLogSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      default: 'ESP32-UNIT-001',
    },
    overallHealthPercent: {
      type: Number,
      required: true,
      default: 92,
    },
    healthyCount: {
      type: Number,
      default: 6,
    },
    warningCount: {
      type: Number,
      default: 1,
    },
    criticalCount: {
      type: Number,
      default: 0,
    },
    componentsSnapshot: [
      {
        componentKey: String,
        name: String,
        status: String,
        healthPercentage: Number,
      },
    ],
    timestamp: {
      type: Date,
      default: Date.now,
      index: -1,
    },
  },
  { timestamps: true }
);

const DiagnosticLog = mongoose.model('DiagnosticLog', diagnosticLogSchema);
export default DiagnosticLog;
