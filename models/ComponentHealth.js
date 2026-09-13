import mongoose from 'mongoose';

const componentHealthSchema = new mongoose.Schema(
  {
    componentKey: {
      type: String,
      required: true,
      unique: true,
      // e.g., 'esp32_controller', 'ultrasonic_sensor', 'water_level_sensor', 'submersible_pump', 'solenoid_valve', 'relay_module', 'network_gateway', 'power_supply'
    },
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['controller', 'sensor', 'actuator', 'infrastructure'],
      required: true,
    },
    status: {
      type: String,
      enum: ['healthy', 'warning', 'critical', 'offline'],
      default: 'healthy',
    },
    healthPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 95,
    },

    // ── Sensor Metrics ──
    sensorId: String,
    currentReading: String, // e.g. "2.4 m", "42.0%"
    readingUnit: String,
    lastCalibrationDate: {
      type: Date,
      default: () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
    nextCalibrationDueDate: {
      type: Date,
      default: () => new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 28 days ahead
    },
    errorCount: {
      type: Number,
      default: 0,
    },

    // ── Actuator Metrics (Pump, Valve, Relay) ──
    state: {
      type: String,
      default: 'STANDBY', // 'RUNNING', 'STOPPED', 'OPEN', 'CLOSED', 'ACTIVE', 'INACTIVE'
    },
    controlMode: {
      type: String,
      enum: ['AUTOMATIC', 'MANUAL'],
      default: 'AUTOMATIC',
    },
    runtimeHours: {
      type: Number,
      default: 342.5,
    },
    actuationCount: {
      type: Number,
      default: 1420,
    },
    operatingTemperatureC: {
      type: Number,
      default: 34.2,
    },
    voltageVolts: {
      type: Number,
      default: 12.1,
    },
    currentAmps: {
      type: Number,
      default: 1.8,
    },
    lastInspectionDate: {
      type: Date,
      default: () => new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },

    maintenanceNotes: {
      type: String,
      default: 'Operating within normal tolerances.',
    },
    lastDiagnosticTime: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const ComponentHealth = mongoose.model('ComponentHealth', componentHealthSchema);
export default ComponentHealth;
