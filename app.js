import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import apiRoutes from './routes/api.js';
import waterLevelRoutes from './routes/waterLevel.js';
import alertRoutes from './routes/alerts.js';
import storageRoutes from './routes/storage.js';
import treatmentRoutes from './routes/treatment.js';
import authRoutes from './routes/auth.js';
import diagnosticsRoutes from './routes/diagnostics.js';
import workOrdersRoutes from './routes/workOrders.js';
import municipalityRoutes from './routes/municipality.js';
import complaintRoutes from './routes/complaints.js';
import predictionRoutes from './routes/prediction.js';
import paymentRoutes from './routes/payments.js';
import adminPlansRoutes from './routes/adminPlans.js';
import ttsRoutes from './routes/tts.js';

const app = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin
    if (!origin) return callback(null, true);
    // Allow localhost, vercel.app domains, and any explicitly configured client URL
    if (
      origin.includes('localhost') ||
      origin.endsWith('.vercel.app') ||
      origin === process.env.CLIENT_URL
    ) {
      return callback(null, true);
    }
    // Allow all other origins in production demo
    return callback(null, true);
  },
  credentials: true,
}));
// Stripe webhooks must receive the raw body for signature verification — skip JSON parsing for that path
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') return next();
  return express.json()(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Routes
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/water-level', waterLevelRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/treatment', treatmentRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);
app.use('/api/work-orders', workOrdersRoutes);
app.use('/api/municipality', municipalityRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminPlansRoutes);
app.use('/api/tts', ttsRoutes);

// Root fallback
app.get('/', (req, res) => {
  res.json({
    message: 'SUOWMRS Core API Server',
    health: '/api/health',
    waterLevel: '/api/water-level/latest',
    alerts: '/api/alerts',
    storage: '/api/storage/current',
    treatment: '/api/treatment/current',
  });
});

export default app;
