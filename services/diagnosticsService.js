import Device from '../models/Device.js';
import ComponentHealth from '../models/ComponentHealth.js';
import WorkOrder from '../models/WorkOrder.js';
import DiagnosticLog from '../models/DiagnosticLog.js';

let io = null;
let diagInterval = null;

// Initial 8 Default Components
const DEFAULT_COMPONENTS = [
  {
    componentKey: 'esp32_controller',
    name: 'ESP32 IoT Node Controller',
    category: 'controller',
    status: 'healthy',
    healthPercentage: 98,
    state: 'RUNNING',
    operatingTemperatureC: 38.4,
    voltageVolts: 3.3,
    maintenanceNotes: 'Firmware v1.0.4 operating smoothly. Memory leak tests passed.',
  },
  {
    componentKey: 'ultrasonic_sensor',
    name: 'Ultrasonic Depth Sensor (JSN-SR04T)',
    category: 'sensor',
    sensorId: 'SN-ULTRA-01',
    status: 'healthy',
    healthPercentage: 96,
    currentReading: '2.4 m',
    readingUnit: 'meters',
    errorCount: 0,
    lastCalibrationDate: new Date('2026-09-10'),
    nextCalibrationDueDate: new Date('2026-10-10'),
    maintenanceNotes: 'Transducer membrane clean. Echo reflection delay nominal.',
  },
  {
    componentKey: 'water_level_sensor',
    name: 'Hydrostatic Pressure Level Sensor',
    category: 'sensor',
    sensorId: 'SN-HYDRO-02',
    status: 'healthy',
    healthPercentage: 94,
    currentReading: '42.0 %',
    readingUnit: 'percentage',
    errorCount: 0,
    lastCalibrationDate: new Date('2026-09-08'),
    nextCalibrationDueDate: new Date('2026-10-08'),
    maintenanceNotes: 'Pressure diaphragm calibrated against hydrostatic column.',
  },
  {
    componentKey: 'submersible_pump',
    name: 'Heavy-Duty Submersible Sump Pump',
    category: 'actuator',
    status: 'healthy',
    healthPercentage: 92,
    state: 'RUNNING',
    controlMode: 'AUTOMATIC',
    runtimeHours: 342.5,
    actuationCount: 420,
    operatingTemperatureC: 44.1,
    voltageVolts: 220.0,
    currentAmps: 4.6,
    lastInspectionDate: new Date('2026-09-05'),
    maintenanceNotes: 'Impeller clear of debris. Thermal cutoff tested.',
  },
  {
    componentKey: 'solenoid_valve',
    name: 'High-Flow 12V Solenoid Diverter Valve',
    category: 'actuator',
    status: 'healthy',
    healthPercentage: 95,
    state: 'OPEN',
    controlMode: 'AUTOMATIC',
    runtimeHours: 198.0,
    actuationCount: 1420,
    operatingTemperatureC: 36.8,
    voltageVolts: 12.0,
    currentAmps: 1.2,
    lastInspectionDate: new Date('2026-09-07'),
    maintenanceNotes: 'Spring seal integrity verified. Opening latency 450ms.',
  },
  {
    componentKey: 'relay_module',
    name: 'Optocoupler 4-Channel Relay Board',
    category: 'actuator',
    status: 'warning',
    healthPercentage: 78,
    state: 'ACTIVE',
    controlMode: 'AUTOMATIC',
    actuationCount: 3890,
    operatingTemperatureC: 52.4,
    voltageVolts: 5.0,
    currentAmps: 0.8,
    lastInspectionDate: new Date('2026-08-15'),
    maintenanceNotes: 'Inspection recommended: Switching contact count exceeded 3,500 cycles.',
  },
  {
    componentKey: 'network_gateway',
    name: 'Industrial 4G LTE / Wi-Fi Gateway',
    category: 'infrastructure',
    status: 'healthy',
    healthPercentage: 99,
    state: 'RUNNING',
    operatingTemperatureC: 32.5,
    voltageVolts: 12.0,
    currentAmps: 0.5,
    maintenanceNotes: 'Cellular link RSSI -58 dBm (Excellent). Ping latency 32ms.',
  },
  {
    componentKey: 'power_supply',
    name: '12V Solar Battery & Regulated SMPS',
    category: 'infrastructure',
    status: 'healthy',
    healthPercentage: 97,
    state: 'RUNNING',
    voltageVolts: 13.8,
    currentAmps: 3.2,
    operatingTemperatureC: 29.8,
    maintenanceNotes: 'Solar charge controller float voltage 13.8V nominal.',
  },
];

export const initDiagnostics = async (socketIo) => {
  io = socketIo;
  console.log('[Diagnostics] Initializing Hardware Diagnostics Engine...');

  try {
    // 1. Seed or find default Device
    let device = await Device.findOne({ deviceId: 'ESP32-UNIT-001' });
    if (!device) {
      device = await Device.create({
        deviceId: 'ESP32-UNIT-001',
        name: 'Primary Node Telemetry Controller',
        status: 'online',
        wifiSignalDbm: -58,
        wifiQuality: 'Excellent',
        ipAddress: '192.168.1.142',
        firmwareVersion: 'v1.0.4',
        uptimeSeconds: 1065600,
      });
      console.log('[Diagnostics] Seeded primary ESP32-UNIT-001 device.');
    }

    // 2. Seed Component Health records
    for (const comp of DEFAULT_COMPONENTS) {
      await ComponentHealth.findOneAndUpdate(
        { componentKey: comp.componentKey },
        { $setOnInsert: comp },
        { upsert: true, new: true }
      );
    }

    // 3. Seed initial work orders if empty
    const woCount = await WorkOrder.countDocuments();
    if (woCount === 0) {
      await WorkOrder.create([
        {
          orderNumber: 'WO-2026-001',
          title: 'Relay Module Contact Resistance Test',
          component: 'Optocoupler 4-Channel Relay Board',
          issueDescription: 'Switching count reached 3,890 cycles. Inspect for contact pitting or excessive heat buildup.',
          priority: 'High',
          status: 'In Progress',
          assignedTechnician: 'Rajesh Kumar (TECH-8842)',
          scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          maintenanceNotes: [
            { note: 'Thermal camera showed 52.4°C on channel 2 terminal.', author: 'Rajesh Kumar', createdAt: new Date() }
          ],
        },
        {
          orderNumber: 'WO-2026-002',
          title: 'Quarterly Ultrasonic Transducer Cleaning',
          component: 'Ultrasonic Depth Sensor (JSN-SR04T)',
          issueDescription: 'Routine preventive inspection for algae or mineral deposits on waterproof transducer face.',
          priority: 'Low',
          status: 'Pending',
          assignedTechnician: 'Rajesh Kumar (TECH-8842)',
          scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      ]);
      console.log('[Diagnostics] Seeded initial maintenance work orders.');
    }

    startDiagnosticsLoop();
  } catch (err) {
    console.error('[Diagnostics] Initialization error:', err);
  }
};

const startDiagnosticsLoop = () => {
  if (diagInterval) clearInterval(diagInterval);

  diagInterval = setInterval(async () => {
    try {
      // 1. Slightly update device uptime and Wi-Fi signal
      const device = await Device.findOne({ deviceId: 'ESP32-UNIT-001' });
      if (device) {
        device.uptimeSeconds += 5;
        device.lastPing = new Date();
        const curRssi = typeof device.wifiSignalDbm === 'number' ? device.wifiSignalDbm : -58;
        device.wifiSignalDbm = Math.round(Math.min(-45, Math.max(-75, curRssi + (Math.random() * 2 - 1))));
        device.cpuTempCelsius = parseFloat((38 + Math.sin(Date.now() / 30000) * 1.5).toFixed(1));
        await device.save();
      }

      // 2. Fetch components and compute overall system health
      const components = await ComponentHealth.find();
      if (components.length > 0) {
        const totalHealth = components.reduce((acc, c) => acc + (c.healthPercentage || 90), 0);
        const overallHealthPercent = Math.round(totalHealth / components.length);
        const healthyCount = components.filter(c => c.status === 'healthy').length;
        const warningCount = components.filter(c => c.status === 'warning').length;
        const criticalCount = components.filter(c => c.status === 'critical').length;

        // Emit live diagnostics update via Socket.io
        if (io) {
          io.emit('diagnostics:update', {
            overallHealthPercent,
            healthyCount,
            warningCount,
            criticalCount,
            totalComponents: components.length,
            device: {
              deviceId: device?.deviceId,
              status: device?.status,
              wifiQuality: device?.wifiQuality,
              wifiSignalDbm: device?.wifiSignalDbm,
              uptimeSeconds: device?.uptimeSeconds,
              lastPing: device?.lastPing,
              cpuTempCelsius: device?.cpuTempCelsius,
            },
            components: components.map(c => ({
              id: c._id,
              componentKey: c.componentKey,
              name: c.name,
              category: c.category,
              status: c.status,
              healthPercentage: c.healthPercentage,
              currentReading: c.currentReading,
              state: c.state,
              operatingTemperatureC: c.operatingTemperatureC,
            })),
            timestamp: new Date(),
          });
        }
      }
    } catch (err) {
      // Continue silently if DB has momentary blip
    }
  }, 5000);
};
