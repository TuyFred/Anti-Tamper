import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { config, supabase } from './config/supabase.js';
import { initDeliverySelect } from './lib/deliverySelect.js';
import { checkDatabase, formatDatabaseLog } from './lib/dbHealth.js';
import { verifyBrevoApiKey } from './services/brevo.js';
import { usesBrevoApi } from './services/email.js';
import { corsOriginCallback } from './config/cors.js';
import { initSocket } from './socket/index.js';
import { initMqtt, shutdownMqtt } from './mqtt/handler.js';
import { setDeliveryIo } from './lib/deliveryNotify.js';
import usersRouter from './routes/users.js';
import authRouter from './routes/auth.js';
import devicesRouter from './routes/devices.js';
import alertsRouter from './routes/alerts.js';
import deliveriesRouter from './routes/deliveries.js';
import reviewsRouter from './routes/reviews.js';
import promoVideosRouter from './routes/promoVideos.js';
import locationsRouter from './routes/locations.js';
import reportsRouter from './routes/reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);

if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(cors({ origin: corsOriginCallback, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: config.nodeEnv === 'production' ? '7d' : 0,
  setHeaders(res, filePath) {
    if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(filePath)) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  },
}));

app.get('/health', async (_req, res) => {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const database = await checkDatabase(supabase);
  const healthy = database.connected;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : database.status,
    service: 'anti-tamper-server',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
    email: {
      enabled: config.email.enabled,
      provider: usesBrevoApi() ? 'brevo-api' : config.email.user ? 'smtp' : 'off',
      from: config.email.from || null,
    },
    supabase: {
      url: supabaseUrl || null,
      reachable: database.connected,
      error: database.error,
    },
    database: {
      provider: 'supabase',
      connected: database.connected,
      status: database.status,
      latencyMs: database.latencyMs,
      project: database.project,
      configured: database.configured,
      tables: database.tables,
      error: database.error,
    },
  });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/promo-videos', promoVideosRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/reports', reportsRouter);

const frontendCandidates = [
  path.resolve(__dirname, '../web'),
  path.resolve(__dirname, '../../client/dist'),
];
const frontendDist = frontendCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));
const frontendIndex = frontendDist ? path.join(frontendDist, 'index.html') : '';
const frontendReady = Boolean(frontendIndex);
if (frontendReady) {
  app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (
      req.path.startsWith('/api')
      || req.path.startsWith('/uploads')
      || req.path.startsWith('/socket.io')
      || req.path === '/health'
    ) {
      return next();
    }
    res.sendFile(frontendIndex);
  });
}

const io = initSocket(httpServer);
setDeliveryIo(io);
initMqtt(io);

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${config.port} is already in use.`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(config.port, '0.0.0.0', async () => {
  await initDeliverySelect(supabase);
  const database = await checkDatabase(supabase);
  console.log(`🚀 Anti-Tamper Server running on port ${config.port}`);
  console.log(`🗄️  ${formatDatabaseLog(database)}`);
  console.log(`📡 MQTT broker: ${config.mqtt.brokerUrl}`);
  console.log(`🌐 CORS origins: ${config.clientOrigins.join(', ')} (+ *.vercel.app)`);
  console.log(`🔗 Public URL: ${config.publicBaseUrl}`);
  if (frontendReady) {
    console.log(`🌐 Website: ${config.publicBaseUrl}/ (same server as API)`);
  } else {
    console.log('🌐 Website bundle not built — API only. On Render, set SUPABASE_ANON_KEY so the client can be compiled.');
  }
  if (usesBrevoApi()) {
    const brevo = await verifyBrevoApiKey();
    if (brevo.ok) {
      console.log(`📧 Brevo API: OK — sending from ${brevo.sender} (account: ${brevo.accountEmail}, plan: ${brevo.plan})`);
    } else {
      console.error(`📧 Brevo API: FAILED — ${brevo.error}`);
    }
  } else if (config.email.enabled && config.email.user) {
    console.log(`📧 Brevo SMTP: ON — ${config.email.host} (from ${config.email.from})`);
  } else {
    console.log('📧 Email: OFF — add BREVO_API_KEY + SMTP_FROM to server/.env');
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
