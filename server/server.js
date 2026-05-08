const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const serveIndex = require('serve-index');
const config = require('./config');
const connectDB = require('./config/db');
const { setupSocket } = require('./config/socket');
const piAuth = require('./middleware/piAuth');
const cronService = require('./services/cron.service');

const app = express();

// ─── HTTPS Setup ─────────────────────────────────────────
const keyFile = path.join(config.certDir, 'key.pem');
const certFile = path.join(config.certDir, 'cert.pem');
const httpsEnabled = fs.existsSync(keyFile) && fs.existsSync(certFile);

// Pfade die OHNE HTTPS erlaubt sind (Players + Setup)
const HTTP_ALLOWED_PATHS = [
  '/socket.io',
  '/newsocket.io',
  '/wssocket.io',
  '/sync_folders',
  '/setup.sh',
  '/player-download',
  '/media',
  '/api/files',
  '/api/groups',
  '/api/playlists',
  '/api/settings',
  '/api/health',
];

// Redirect-Middleware: erzwingt HTTPS für UI/Admin
if (httpsEnabled) {
  app.use((req, res, next) => {
    if (req.protocol === 'https' || req.socket.encrypted) return next();
    const allowed = HTTP_ALLOWED_PATHS.some((p) => req.path === p || req.path.startsWith(p + '/') || req.path.startsWith(p));
    if (allowed) return next();
    const host = (req.headers.host || '').replace(/:\d+$/, '');
    return res.redirect(301, `https://${host}:${config.httpsPort}${req.url}`);
  });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded media (thumbnails, screenshots)
app.use('/media', express.static(config.mediaDir));

// /sync_folders – Player file download
app.use(
  '/sync_folders',
  piAuth,
  (req, res, next) => {
    res.removeHeader('cache-control');
    res.removeHeader('pragma');
    next();
  },
  serveIndex(config.syncDir),
  express.static(config.syncDir)
);

// Player download
const playerDir = path.join(__dirname, '..', 'player');
app.use('/player-download', express.static(playerDir));

// Setup-Script
app.get('/setup.sh', (req, res) => {
  res.sendFile(path.join(playerDir, 'setup.sh'));
});

// API Routes (JWT auth)
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/users', require('./routes/user.routes'));
app.use('/api/v1/user-groups', require('./routes/userGroup.routes'));
app.use('/api/v1/display-groups', require('./routes/displayGroup.routes'));
app.use('/api/v1/assets', require('./routes/asset.routes'));
app.use('/api/v1/playlists', require('./routes/playlist.routes'));
app.use('/api/v1/players', require('./routes/player.routes'));
app.use('/api/v1/logs', require('./routes/log.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// piSignage Compat-Routes
app.use('/api', require('./routes/pi.routes'));

// React Build
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/sync_folders') || req.path.startsWith('/media')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Server starten
async function start() {
  await connectDB();

  // HTTP server (Players + Redirects)
  const httpServer = http.createServer(app);

  // HTTPS server (Admin UI)
  let httpsServer = null;
  if (httpsEnabled) {
    httpsServer = https.createServer(
      { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) },
      app
    );
  }

  // Socket.IO an HTTP-Server (Players verbinden über HTTP)
  const ioInstances = setupSocket(httpServer);
  app.set('io', ioInstances.io);
  app.set('ioInstances', ioInstances);

  httpServer.listen(config.port, () => {
    console.log(`mySignage HTTP server running on port ${config.port}`);
    console.log(`Socket.IO listening on /, /newsocket.io, /wssocket.io`);
  });

  if (httpsServer) {
    httpsServer.listen(config.httpsPort, () => {
      console.log(`mySignage HTTPS server running on port ${config.httpsPort} (self-signed cert)`);
    });
  } else {
    console.log('HTTPS disabled (no cert found in ' + config.certDir + ')');
  }

  cronService.start(ioInstances);
}

start();

module.exports = { app };
