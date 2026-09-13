import mongoose from 'mongoose';

const storageSchema = new mongoose.Schema({
  totalCapacity: { type: Number, default: 10000 }, // litres
  currentVolume: { type: Number, default: 7200 },
  fillPercentage: { type: Number, default: 72 },
  valveStatus: { type: String, enum: ['OPEN', 'STANDBY'], default: 'STANDBY' },
  inFlowRate: { type: Number, default: 0 }, // litres per minute
  isManualOverride: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
});

storageSchema.index({ timestamp: -1 });

const Storage = mongoose.model('Storage', storageSchema);
export default Storage;
