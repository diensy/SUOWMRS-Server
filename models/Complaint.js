import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    citizenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    citizenName: {
      type: String,
      required: true,
      default: 'Aarav Sharma',
    },
    citizenMobile: {
      type: String,
      default: '+91 98765 43210',
    },
    issueType: {
      type: String,
      enum: ['Water Overflow', 'Drainage Blockage', 'Flooding', 'System Damage', 'Water Leakage', 'Other'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
    },
    ward: {
      type: String,
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed'],
      default: 'Submitted',
      index: true,
    },
    photoUrl: {
      type: String,
      default: '',
    },
    assignedTechnician: {
      type: String,
      default: 'Unassigned',
    },
    linkedWorkOrderId: {
      type: String,
      default: '',
    },
    resolutionNotes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

complaintSchema.index({ status: 1, priority: 1, ward: 1 });

export default mongoose.model('Complaint', complaintSchema);
