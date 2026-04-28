import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import consumptionRoutes from './routes/consumption.js';
import predictionRoutes from './routes/predictions.js';
import recommendationRoutes from './routes/recommendations.js';
import familyRoutes from './routes/family.js';
import paymentRoutes from './routes/payments.js';
import { startScheduledPayments } from './services/scheduledPayments.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    /\.vercel\.app$/,
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'UniPowerWallet Backend is running',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/consumption', consumptionRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/payments', paymentRoutes);

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path 
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

startScheduledPayments();

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 UniPowerWallet Backend Server       ║
║   📡 Running on: http://localhost:${PORT}  ║
║   🌍 Environment: ${process.env.NODE_ENV}           ║
║   ⚡ Status: Ready to accept requests    ║
╚═══════════════════════════════════════════╝
  `);
});

export default app;