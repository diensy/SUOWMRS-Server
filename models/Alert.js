import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['normal', 'warning', 'danger', 'critical'],
    required: true,
  },
  message: { type: String, required: true },
  messageKey: { type: String, default: 'alert_normal' },
  level: { type: Number },
  location: { type: String, default: 'Zone 4 - Ward 12 Riverbed' },
  sensorId: { type: String, default: 'SYS-042' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

alertSchema.index({ createdAt: -1 });
alertSchema.index({ isRead: 1 });

const Alert = mongoose.model('Alert', alertSchema);
export default Alert;
