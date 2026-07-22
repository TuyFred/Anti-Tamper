import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { config } from './config/supabase.js';
import { corsOriginCallback } from './config/cors.js';
import { initSocket } from './socket/index.js';
import { initMqtt, shutdownMqtt } from './mqtt/handler.js';
import usersRouter from './routes/users.js';
import devicesRouter from './routes/devices.js';
import alertsRouter from './routes/alerts.js';
import deliveriesRouter from './routes/deliveries.js';
import reviewsRouter from './routes/reviews.js';
import promoVideosRouter from './routes/promoVideos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);

if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(cors({ origin: corsOriginCallback, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'anti-tamper-server',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

app.use('/api/users', usersRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/promo-videos', promoVideosRouter);
app.use('/api/alerts', alertsRouter);

const io = initSocket(httpServer);
initMqtt(io);

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${config.port} is already in use.`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 Anti-Tamper Server running on port ${config.port}`);
  console.log(`📡 MQTT broker: ${config.mqtt.brokerUrl}`);
  console.log(`🌐 CORS origins: ${config.clientOrigins.join(', ')} (+ *.vercel.app)`);
  console.log(`🔗 Public URL: ${config.publicBaseUrl}`);
  if (config.email.enabled) {
    console.log(`📧 Email alerts: ON (${config.email.host})`);
  } else {
    console.log('📧 Email alerts: OFF (set EMAIL_ENABLED=true)');
  }
  if (config.nodeEnv !== 'production') {
    console.log('⌨️  Type rs + Enter to restart (nodemon)');
  }
});

function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  shutdownMqtt();
  io.close();
  httpServer.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
