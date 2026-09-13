import HistoricalTelemetry from '../models/HistoricalTelemetry.js';

/**
 * Initializes and seeds realistic multi-day historical telemetry data
 * if the database collection is empty or sparse.
 */
export async function initHistoricalDataset() {
  try {
    const count = await HistoricalTelemetry.countDocuments();
    if (count < 100) {
      console.log('📊 Seeding Phase 7.1 Historical Telemetry Dataset for Flood Prediction...');
      const records = [];
      const now = Date.now();
      const oneHourMs = 3600 * 1000;
      
      const wards = ['Ward 12', 'Ward 4', 'Ward 3', 'Ward 1', 'Ward 8'];
      
      // Simulate 72 hours of historical hourly snapshots for 5 reference wards
      for (let h = 72; h >= 0; h--) {
        const timestamp = new Date(now - h * oneHourMs);
        
        // Diurnal & weather wave simulation:
        // Peak storm period occurred around 12 to 24 hours ago
        const isStormPeriod = h >= 12 && h <= 24;
        const isModerateRain = (h >= 8 && h < 12) || (h > 24 && h <= 36);
        
        for (const ward of wards) {
          let rainfallMm = 0;
          let intensity = 'None';
          let waterLevelPct = Math.floor(Math.random() * 15) + 20; // baseline 20-35%
          let flowRate = Math.floor(Math.random() * 30) + 40; // baseline 40-70 L/min
          let storagePct = Math.floor(Math.random() * 20) + 30; // 30-50%
          let valveState = 'CLOSED';
          let pumpState = 'STANDBY';
          let temp = +(31 - (h % 24) * 0.25).toFixed(1);

          if (isStormPeriod) {
            rainfallMm = +(Math.random() * 35 + 30).toFixed(1); // 30 - 65 mm/hr
            intensity = rainfallMm > 50 ? 'Violent' : 'Heavy';
            waterLevelPct = Math.min(98, Math.floor(Math.random() * 20 + 78)); // 78 - 98%
            flowRate = Math.floor(Math.random() * 100 + 160); // 160 - 260 L/min
            storagePct = Math.min(96, Math.floor(Math.random() * 25 + 72));
            valveState = waterLevelPct >= 75 ? 'OPEN' : 'CLOSED';
            pumpState = 'ACTIVE';
            temp = 25.5;
          } else if (isModerateRain) {
            rainfallMm = +(Math.random() * 18 + 8).toFixed(1); // 8 - 26 mm/hr
            intensity = rainfallMm > 15 ? 'Moderate' : 'Light';
            waterLevelPct = Math.floor(Math.random() * 20 + 50); // 50 - 70%
            flowRate = Math.floor(Math.random() * 50 + 90);
            storagePct = Math.floor(Math.random() * 20 + 50);
            valveState = 'CLOSED';
            pumpState = 'STANDBY';
            temp = 27.8;
          }

          // Compute Drainage Saturation Index (DSI)
          // DSI = (0.45 * waterLevelPct) + (0.35 * (rainfallMm / 60 * 100)) + (0.20 * storagePct)
          const dsi = Math.min(100, Math.round(
            (0.45 * waterLevelPct) +
            (0.35 * Math.min(100, (rainfallMm / 60) * 100)) +
            (0.20 * storagePct)
          ));

          const depthMeters = +((waterLevelPct / 100) * 4.0).toFixed(2);
          const floodObserved = waterLevelPct >= 90;

          records.push({
            timestamp,
            ward,
            location: `${ward} Drainage Basin`,
            waterLevelDepthMeters: depthMeters,
            waterLevelPercentage: waterLevelPct,
            drainageFlowRate: flowRate,
            rainfallMmPerHour: rainfallMm,
            rainfallIntensity: intensity,
            temperatureC: temp,
            storageCapacityLiters: 10000,
            storagePercentage: storagePct,
            valveState,
            pumpState,
            drainageSaturationIndex: dsi,
            floodEventObserved: floodObserved,
          });
        }
      }

      await HistoricalTelemetry.insertMany(records);
      console.log(`✅ Seeded ${records.length} historical telemetry records for Phase 7.1!`);
    }
  } catch (err) {
    console.error('Error initializing historical telemetry dataset:', err);
  }
}

/**
 * Returns time-series historical records filtered by hours and ward
 */
export async function getHistoricalDataset({ hours = 24, ward = null, limit = 500 } = {}) {
  try {
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const filter = { timestamp: { $gte: since } };
    if (ward && ward !== 'All') {
      filter.ward = ward;
    }

    return await HistoricalTelemetry.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.error('Failed to query historical dataset:', err);
    return [];
  }
}

/**
 * Real-time logging helper to continuously record new telemetry snapshots
 */
export async function logTelemetrySnapshot(snapshot) {
  try {
    const record = new HistoricalTelemetry(snapshot);
    await record.save();
    return record;
  } catch (err) {
    // Non-blocking log
  }
}
