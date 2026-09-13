import express from 'express';
import Complaint from '../models/Complaint.js';
import WorkOrder from '../models/WorkOrder.js';
import { authenticate } from './auth.js';

const router = express.Router();

// Helper to seed initial complaints if empty
export async function seedInitialComplaints() {
  try {
    const count = await Complaint.countDocuments();
    if (count === 0) {
      const demoComplaints = [
        {
          complaintId: 'CMP-2026-001',
          citizenName: 'Aarav Sharma',
          citizenMobile: '+91 98765 43210',
          issueType: 'Drainage Blockage',
          title: 'Severe plastic accumulation at Ward 12 Main Drain',
          description: 'Main drainage grate is completely blocked with plastic waste and mud after heavy rain.',
          location: 'Zone 4 - Ward 12 Riverbed Crossing',
          ward: 'Ward 12',
          priority: 'High',
          status: 'Assigned',
          assignedTechnician: 'Rajesh Kumar (TECH-8842)',
        },
        {
          complaintId: 'CMP-2026-002',
          citizenName: 'Priya Das',
          citizenMobile: '+91 98765 11223',
          issueType: 'Water Overflow',
          title: 'Water overflowing onto market road',
          description: 'Underground storage diverter appears slow to open causing water backup on street.',
          location: 'Market Ridge Culvert',
          ward: 'Ward 5',
          priority: 'Urgent',
          status: 'Submitted',
          assignedTechnician: 'Unassigned',
        },
        {
          complaintId: 'CMP-2026-003',
          citizenName: 'Rohan Mohanty',
          citizenMobile: '+91 98765 99887',
          issueType: 'Water Leakage',
          title: 'Minor leakage near solenoid valve junction',
          description: 'Diverter pipe joint has a steady trickle leak into side gutter.',
          location: 'East Side Channel',
          ward: 'Ward 18',
          priority: 'Medium',
          status: 'In Progress',
          assignedTechnician: 'Ramesh Sahoo (TECH-9021)',
        },
      ];
      await Complaint.insertMany(demoComplaints);
      console.log('✅ Seeded initial demo citizen complaints!');
    }
  } catch (err) {
    // Avoid crashing if database is not available
  }
}


// ───────── POST /api/complaints (Citizen files complaint) ─────────
router.post('/', async (req, res) => {
  try {
    const { issueType, title, description, location, ward, priority = 'Medium', photoUrl = '' } = req.body;

    if (!issueType || !title || !description || !location || !ward) {
      return res.status(400).json({ error: 'Please fill in all required complaint fields.' });
    }

    const totalCount = await Complaint.countDocuments();
    const complaintId = `CMP-2026-${String(totalCount + 1).padStart(3, '0')}`;

    const newComplaint = await Complaint.create({
      complaintId,
      citizenName: req.user?.fullName || 'Resident Citizen',
      citizenMobile: req.user?.mobileNumber || '+91 98765 43210',
      issueType,
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      ward: ward.trim(),
      priority,
      status: 'Submitted',
      photoUrl,
    });

    res.status(201).json({
      success: true,
      message: `Complaint ${complaintId} submitted successfully. Track status under Citizen Portal.`,
      complaint: newComplaint,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to submit complaint.' });
  }
});

// ───────── GET /api/complaints (Admin list with filter & search) ─────────
router.get('/', async (req, res) => {
  try {
    const { status = 'All', priority = 'All', search = '' } = req.query;
    const filter = {};

    if (status !== 'All') filter.status = status;
    if (priority !== 'All') filter.priority = priority;

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { complaintId: searchRegex },
        { title: searchRegex },
        { location: searchRegex },
        { ward: searchRegex },
        { citizenName: searchRegex },
      ];
    }

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch complaints.' });
  }
});

// ───────── PATCH /api/complaints/:id (Admin update status / assign tech / link work order) ─────────
router.patch('/:id', async (req, res) => {
  try {
    const { status, priority, assignedTechnician, resolutionNotes, createWorkOrder } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    if (status) complaint.status = status;
    if (priority) complaint.priority = priority;
    if (assignedTechnician) complaint.assignedTechnician = assignedTechnician;
    if (resolutionNotes) complaint.resolutionNotes = resolutionNotes;

    // Optional integration flow: Automatically create / link a Work Order in Technician Suite!
    if (createWorkOrder) {
      const woCount = await WorkOrder.countDocuments();
      const orderNumber = `WO-2026-${String(woCount + 1).padStart(3, '0')}`;

      const newWorkOrder = await WorkOrder.create({
        orderNumber,
        title: `Fix: ${complaint.title}`,
        component: complaint.issueType === 'Water Leakage' ? 'Solenoid Valve' : 'Ultrasonic Sensor',
        issueDescription: `Citizen Complaint (${complaint.complaintId}): ${complaint.description}`,
        priority: complaint.priority === 'Urgent' ? 'Critical' : complaint.priority,
        status: 'In Progress',
        assignedTechnician: complaint.assignedTechnician || 'Rajesh Kumar (TECH-8842)',
      });

      complaint.linkedWorkOrderId = newWorkOrder.orderNumber;
      complaint.status = 'Assigned';
    }

    await complaint.save();

    res.json({
      success: true,
      message: `Complaint ${complaint.complaintId} updated successfully.`,
      complaint,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update complaint.' });
  }
});

export default router;
