const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const serveIndex = require('serve-index');
const config = require('./config');
const connectDB = require('./config/db');
const { setupSocket } = require('./config/socket');
const piAuth = require('./middleware/piAuth');
const cronService = require('./services/cron.service');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded media (thumbnails, screenshots) for admin UI
app.use('/media', express.static(config.mediaDir));

// /sync_folders – piSignage player file download (Basic auth)
app.use(
  '/sync_folders',
  piAuth,
  (req, res, next) => {
    // Remove cache headers for wget compatibility
    res.removeHeader('cache-control');
    res.removeHeader('pragma');
    next();
  },
  serveIndex(config.syncDir),
  express.static(config.syncDir)
);

// Player download - serves player files for Pi setup script
const playerDir = path.join(__dirname, '..', 'player');
app.use('/player-download', express.static(playerDir));

// Setup script (direct download)
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

// Health check (before piSignage routes)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// piSignage player compatibility routes (Basic auth)
app.use('/api', require('./routes/pi.routes'));

// Serve React production build
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/sync_folders') || req.path.startsWith('/media')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Start
async function start() {
  await connectDB();

  // Setup Socket.IO (3 paths for piSignage player generations)
  const ioInstances = setupSocket(server);
  app.set('io', ioInstances.io);
  app.set('ioInstances', ioInstances);

  server.listen(config.port, () => {
    console.log(`mySignage server running on port ${config.port}`);
    console.log(`Socket.IO listening on /, /newsocket.io, /wssocket.io`);

    // Start cron (schedule re-deploy + sleep/CEC every 5 min)
    cronService.start(ioInstances);
  });
}

start();

module.exports = { app, server };
