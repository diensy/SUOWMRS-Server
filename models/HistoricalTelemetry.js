import mongoose from 'mongoose';

const historicalTelemetrySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  ward: { type: String, required: true, default: 'Ward 12' },
  location: { type: String, required: true, default: 'Zone 4 - Ward 12 Riverbed' },
  
  // Hydrological & Drainage Telemetry
  waterLevelDepthMeters: { type: Number, required: true, default: 1.8 },
  waterLevelPercentage: { type: Number, required: true, min: 0, max: 100, default: 45 },
  drainageFlowRate: { type: Number, required: true, default: 120 }, // Litres / min
  
  // Weather & Precipitation
  rainfallMmPerHour: { type: Number, required: true, default: 15 },
  rainfallIntensity: {
    type: String,
    enum: ['None', 'Light', 'Moderate', 'Heavy', 'Violent'],
    default: 'Moderate',
  },
  temperatureC: { type: Number, default: 28.5 },
  
  // Storage & Actuators
  storageCapacityLiters: { type: Number, default: 10000 },
  storagePercentage: { type: Number, min: 0, max: 100, default: 60 },
  valveState: { type: String, enum: ['OPEN', 'CLOSED'], default: 'CLOSED' },
  pumpState: { type: String, enum: ['ACTIVE', 'STANDBY', 'OFF'], default: 'STANDBY' },
  
  // Drainage Saturation Index (DSI)
  drainageSaturationIndex: { type: Number, min: 0, max: 100, default: 52 },
  
  // Tagging for analysis
  isAnomaly: { type: Boolean, default: false },
  floodEventObserved: { type: Boolean, default: false },
});

historicalTelemetrySchema.index({ timestamp: -1, ward: 1 });

const HistoricalTelemetry = mongoose.model('HistoricalTelemetry', historicalTelemetrySchema);
export default HistoricalTelemetry;
