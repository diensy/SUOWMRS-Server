import mongoose from 'mongoose';

const waterLevelSchema = new mongoose.Schema({
  sensorId: { type: String, default: 'SYS-042' },
  location: { type: String, default: 'Zone 4 - Ward 12 Riverbed' },
  level: { type: Number, required: true, min: 0, max: 100 },
  status: {
    type: String,
    enum: ['normal', 'warning', 'danger', 'critical'],
    required: true,
  },
  depthMeters: { type: Number },
  timestamp: { type: Date, default: Date.now },
});

waterLevelSchema.index({ timestamp: -1 });

const WaterLevel = mongoose.model('WaterLevel', waterLevelSchema);
export default WaterLevel;
