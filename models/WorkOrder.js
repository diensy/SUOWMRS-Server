import mongoose from 'mongoose';

const workOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: [true, 'Work order title is required'],
      trim: true,
    },
    component: {
      type: String,
      required: [true, 'Affected component must be specified'],
      trim: true,
    },
    issueDescription: {
      type: String,
      required: [true, 'Issue description is required'],
      trim: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
      default: 'Pending',
    },
    assignedTechnician: {
      type: String,
      default: 'Rajesh Kumar (TECH-8842)',
    },
    scheduledDate: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    },
    completedAt: {
      type: Date,
    },
    maintenanceNotes: [
      {
        note: String,
        author: { type: String, default: 'Technician' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

workOrderSchema.index({ status: 1 });
workOrderSchema.index({ priority: 1 });
workOrderSchema.index({ createdAt: -1 });

const WorkOrder = mongoose.model('WorkOrder', workOrderSchema);
export default WorkOrder;
