import mongoose from 'mongoose';

const predictionRecordSchema = new mongoose.Schema({
  predictionId: { type: String, required: true, unique: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  targetWindow: { type: String, default: 'Next 30–60 minutes' },
  ward: { type: String, default: 'Ward 12' },
  location: { type: String, default: 'Zone 4 - Ward 12 Riverbed Basin' },
  
  // Model Predictions
  floodProbability: { type: Number, required: true, min: 0, max: 100 },
  riskLevel: {
    type: String,
    enum: ['Low', 'Moderate', 'High', 'Critical'],
    required: true,
  },
  drainageSaturationIndex: { type: Number, required: true, min: 0, max: 100 },
  rainfallForecastMm: { type: Number, required: true },
  
  // Explainability & Contributing Factors
  mainFactors: [{ type: String }],
  recommendedAction: { type: String },
  modelVersion: { type: String, default: 'SUOWMRS-HydroML v1.4 (Hydrological Prototype)' },
  confidence: { type: Number, min: 0, max: 100, default: 87.5 },
  
  // Empirical Accuracy & Ground Truth Auditing (Phase 7.8)
  actualOutcome: {
    type: String,
    enum: ['Flooded', 'Near Capacity', 'Normal', 'Pending'],
    default: 'Pending',
  },
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Verified'],
    default: 'Pending',
  },
  classification: {
    type: String,
    enum: ['True Positive', 'False Positive', 'True Negative', 'False Negative', 'Unverified'],
    default: 'Unverified',
  },
  verifiedAt: { type: Date },
});

predictionRecordSchema.index({ timestamp: -1, riskLevel: 1 });

const PredictionRecord = mongoose.model('PredictionRecord', predictionRecordSchema);
export default PredictionRecord;
