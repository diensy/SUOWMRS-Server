import './config/dns.js';
import http from 'http';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { connectDB } from './config/db.js';
import { setupSockets } from './sockets/index.js';
import { initSimulator } from './services/sensorSimulator.js';
import { initDiagnostics } from './services/diagnosticsService.js';
import { initMunicipalityNodes, startMunicipalitySimulation } from './services/municipalityService.js';
import { initHistoricalDataset } from './services/datasetService.js';
import { initWeatherService } from './services/weatherService.js';
import { initPredictionAuditDataset } from './services/predictionEngine.js';
import { seedInitialComplaints } from './routes/complaints.js';

// Load environment configuration
dotenv.config();

const PORT = process.env.PORT || 5000;

// Create HTTP server wrapping Express
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
});

// Setup sockets
setupSockets(io);

// Connect to Database & Start Server
connectDB()
  .then((conn) => {
    if (conn) {
      // Initialize services that require DB connection
      initSimulator(io);
      initDiagnostics(io);
      initMunicipalityNodes();
      startMunicipalitySimulation(io);
      initHistoricalDataset();
      initWeatherService();
      initPredictionAuditDataset();
      seedInitialComplaints();
    }
  })
  .catch((err) => {
    console.error(`[Server Warning] Database connection failed (${err.message}). Server running in standalone API mode.`);
  })
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🌊 SUOWMRS Server running on port ${PORT}`);
      console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
      console.log(`⚡ WebSocket Stream ready`);
      console.log(`📊 Sensor Simulator: Active (5s interval)`);
      console.log(`=========================================`);
    });
  });

export { io };
