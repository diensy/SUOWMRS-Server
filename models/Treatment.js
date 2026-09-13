import mongoose from 'mongoose';

const treatmentSchema = new mongoose.Schema({
  storedWater: { type: Number, default: 8500 },    // litres
  treatedWater: { type: Number, default: 6200 },
  availableForReuse: { type: Number, default: 5900 },
  qualityStatus: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good',
  },
  allocations: {
    gardening: { type: Number, default: 1800 },
    cleaning: { type: Number, default: 1200 },
    irrigation: { type: Number, default: 1500 },
    construction: { type: Number, default: 900 },
    industrial: { type: Number, default: 500 },
  },
  treatmentEfficiency: { type: Number, default: 73 }, // percent
  timestamp: { type: Date, default: Date.now },
});

treatmentSchema.index({ timestamp: -1 });

const Treatment = mongoose.model('Treatment', treatmentSchema);
export default Treatment;
