import mongoose from 'mongoose';

const systemNodeSchema = new mongoose.Schema(
  {
    systemId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ward: {
      type: String,
      required: true,
      index: true,
    },
    location: {
      type: String,
      required: true,
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    waterLevel: {
      type: Number,
      default: 35,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ['Normal', 'Warning', 'Critical', 'Offline'],
      default: 'Normal',
      index: true,
    },
    storageLevel: {
      type: Number,
      default: 45,
      min: 0,
      max: 100,
    },
    deviceStatus: {
      type: String,
      enum: ['Online', 'Offline', 'Degraded'],
      default: 'Online',
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

systemNodeSchema.index({ status: 1, ward: 1 });

export default mongoose.model('SystemNode', systemNodeSchema);
