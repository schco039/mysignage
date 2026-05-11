const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const { io: ioClient } = require('socket.io-client');
const os = require('os');
const { execSync } = require('child_process');

// ─── Config ──────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, 'config.json');
const MEDIA_DIR = path.join(__dirname, 'media');
const STATE_FILE = path.join(__dirname, 'state.json');
const LOCAL_PORT = 8000;

// Load config (muss von setup.sh angelegt sein)
let config = {
  serverUrl: '',
  playerName: '',
  localPort: LOCAL_PORT,
};

if (fs.existsSync(CONFIG_FILE)) {
  Object.assign(config, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
}

if (!config.serverUrl) {
  console.error('[Player] FEHLER: Keine serverUrl in config.json!');
  console.error('[Player] config.json wird erwartet unter:', CONFIG_FILE);
  process.exit(1);
}

fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

// Ensure media directory
fs.mkdirSync(MEDIA_DIR, { recursive: true });

// ─── Player Identity ─────────────────────────────────────
function getCpuSerial() {
  try {
    const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    const match = cpuinfo.match(/Serial\s*:\s*(\w+)/);
    if (match) return match[1];
  } catch {}
  // Fallback: use MAC address hash
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (!net.internal && net.mac !== '00:00:00:00:00:00') {
        return net.mac.replace(/:/g, '');
      }
    }
  }
  return 'unknown-' + Date.now();
}

function getMacAddresses() {
  const nets = os.networkInterfaces();
  let ethMac = '', wifiMac = '';
  for (const [name, iface] of Object.entries(nets)) {
    for (const net of iface) {
      if (net.internal || net.mac === '00:00:00:00:00:00') continue;
      if (name.startsWith('eth') || name.startsWith('en')) ethMac = ethMac || net.mac;
      if (name.startsWith('wl')) wifiMac = wifiMac || net.mac;
    }
  }
  return { ethMac, wifiMac };
}

function getIpAddress() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (!net.internal && net.family === 'IPv4') return net.address;
    }
  }
  return '0.0.0.0';
}

function getDiskSpace() {
  try {
    const result = execSync("df -h / | tail -1", { encoding: 'utf8' });
    const parts = result.trim().split(/\s+/);
    return { used: parts[2] || '?', available: parts[3] || '?' };
  } catch {
    return { used: '?', available: '?' };
  }
}

function getCpuTemp() {
  try {
    const temp = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
    return (parseInt(temp) / 1000).toFixed(1) + "'C";
  } catch {
    return '?';
  }
}

// ─── HDMI-Output an/aus für CEC-Sleep ─────────────────────
// Pi OS Trixie/Wayland: vcgencmd ist deprecated → wlr-randr/wlopm nutzen.
// Service läuft als pi-User aber kennt das Wayland-Socket nicht von selbst.
function setHdmiPower(on) {
  const uid = process.getuid ? process.getuid() : 1000;
  const xdgRuntimeDir = `/run/user/${uid}`;

  // Wayland-Socket finden (wayland-0, wayland-1, ...)
  let waylandDisplay = 'wayland-0';
  try {
    const sockets = fs.readdirSync(xdgRuntimeDir).filter((f) => /^wayland-\d+$/.test(f));
    if (sockets[0]) waylandDisplay = sockets[0];
  } catch {}

  const env = {
    ...process.env,
    WAYLAND_DISPLAY: waylandDisplay,
    XDG_RUNTIME_DIR: xdgRuntimeDir,
  };

  // Methode 1: wlopm (einfachste Wayland-Methode)
  try {
    execSync(`wlopm --${on ? 'on' : 'off'} '*'`, { timeout: 3000, env });
    return;
  } catch {}

  // Methode 2: wlr-randr für jeden Output
  try {
    const out = execSync('wlr-randr', { encoding: 'utf8', timeout: 3000, env });
    const outputs = out
      .split('\n')
      .filter((l) => /^[A-Z]/.test(l))
      .map((l) => l.split(' ')[0])
      .filter(Boolean);
    for (const o of outputs) {
      try { execSync(`wlr-randr --output ${o} --${on ? 'on' : 'off'}`, { timeout: 3000, env }); } catch {}
    }
    return;
  } catch {}

  // Methode 3: vcgencmd (Pi-Firmware Legacy)
  try { execSync(`vcgencmd display_power ${on ? 1 : 0}`, { timeout: 3000 }); } catch {}
}

const cpuSerialNumber = getCpuSerial();
const { ethMac, wifiMac } = getMacAddresses();
console.log(`[Player] ID: ${cpuSerialNumber}`);
console.log(`[Player] Server: ${config.serverUrl}`);

// ─── State (survives reboot) ─────────────────────────────
let state = {
  playlist: null,
  config: null,
  files: [],
  defaultScreen: 'modern',
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      console.log('[Player] Loaded saved state');
    }
  } catch (err) {
    console.warn('[Player] Could not load state:', err.message);
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn('[Player] Could not save state:', err.message);
  }
}

loadState();

// ─── File Download ───────────────────────────────────────
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    client.get(url, (res) => {
      if (res.statusCode === 401) {
        // Try with Basic auth for /sync_folders
        const authUrl = new URL(url);
        authUrl.username = 'pi';
        authUrl.password = 'pi';
        client.get(authUrl.toString(), (res2) => {
          res2.pipe(file);
          file.on('finish', () => file.close(resolve));
        }).on('error', reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function syncFiles(configData) {
  if (!configData || !configData.assets) return;

  const groupName = configData.name;
  const neededFiles = configData.assets.map((a) => a.filename);

  // Download missing files
  for (const filename of neededFiles) {
    const localPath = path.join(MEDIA_DIR, filename);
    if (fs.existsSync(localPath)) continue;

    const url = `${config.serverUrl}/sync_folders/${encodeURIComponent(groupName)}/${encodeURIComponent(filename)}`;
    console.log(`[Player] Downloading: ${filename}`);
    try {
      await downloadFile(url, localPath);
      console.log(`[Player] Downloaded: ${filename}`);
    } catch (err) {
      console.error(`[Player] Download failed: ${filename}`, err.message);
    }
  }

  // Remove files no longer needed
  const existing = fs.readdirSync(MEDIA_DIR);
  for (const file of existing) {
    if (!neededFiles.includes(file)) {
      fs.unlinkSync(path.join(MEDIA_DIR, file));
      console.log(`[Player] Removed: ${file}`);
    }
  }

  state.files = neededFiles;
  saveState();
}

// ─── Local HTTP Server (for Chromium) ────────────────────
const localApp = express();

// Serve media files
localApp.use('/media', express.static(MEDIA_DIR));

// Player status API (for the webpage)
localApp.get('/api/status', (req, res) => {
  res.json({
    cpuSerialNumber,
    playerName: config.playerName || cpuSerialNumber,
    ip: getIpAddress(),
    serverUrl: config.serverUrl,
    serverConnected,
    playlist: state.playlist,
    config: state.config,
    files: state.files,
    defaultScreen: state.defaultScreen,
  });
});

// Serve player webpage
localApp.use(express.static(path.join(__dirname, 'public')));
localApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

localApp.listen(LOCAL_PORT, () => {
  console.log(`[Player] Local server on http://localhost:${LOCAL_PORT}`);
});

// ─── Socket.IO Connection to Server ─────────────────────
let serverConnected = false;
let tvStatus = true; // wird via CEC-Commands aktualisiert

function connectToServer() {
  const socket = ioClient(config.serverUrl, {
    path: '/newsocket.io',
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionAttempts: Infinity,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    serverConnected = true;
    console.log('[Player] Connected to server');
    sendStatus(socket);
  });

  socket.on('disconnect', (reason) => {
    serverConnected = false;
    console.log('[Player] Disconnected:', reason);
  });

  // Receive config from server (after status or deploy)
  socket.on('config', async (configData) => {
    console.log('[Player] Received config:', configData.name);
    state.config = configData;
    if (configData.defaultScreen) {
      state.defaultScreen = configData.defaultScreen;
    }

    // Build playlist from config
    if (configData.playlists && configData.playlists.length > 0) {
      const allAssets = [];
      for (const pl of configData.playlists) {
        for (const asset of pl.assets || []) {
          allAssets.push({
            filename: asset.filename,
            duration: asset.duration || 10,
            type: asset.type || guessType(asset.filename),
          });
        }
      }
      state.playlist = {
        name: configData.playlists[0].name,
        assets: allAssets,
      };
    } else {
      state.playlist = null;
    }

    saveState();

    // Download files
    await syncFiles(configData);
  });

  // Server requests screenshot
  socket.on('snapshot', () => {
    console.log('[Player] Screenshot requested (not implemented in Chromium mode)');
    // Could use puppeteer or scrot here
  });

  // Server sends shell command
  socket.on('shell', (data) => {
    console.log('[Player] Shell command:', data.cmd);
    try {
      const result = execSync(data.cmd, { encoding: 'utf8', timeout: 30000 });
      socket.emit('shell_ack', result);
    } catch (err) {
      socket.emit('shell_ack', `Error: ${err.message}`);
    }
  });

  // Server sends TV power command
  socket.on('cmd', (data) => {
    if (data.cmd === 'tvpower') {
      const on = !!data.args.on;
      // 1. CEC-Command an TV
      const cecCmd = on ? 'echo "on 0" | cec-client -s -d 1' : 'echo "standby 0" | cec-client -s -d 1';
      try {
        execSync(cecCmd, { timeout: 10000 });
      } catch (err) {
        console.warn('[Player] CEC command failed:', err.message);
      }
      setHdmiPower(on);

      tvStatus = on;
      console.log(`[Player] TV power: ${tvStatus ? 'on' : 'off'}`);
      if (socket.connected) sendStatus(socket);
    }
  });

  // Send status every 3 minutes
  setInterval(() => {
    if (socket.connected) sendStatus(socket);
  }, 3 * 60 * 1000);

  return socket;
}

function sendStatus(socket) {
  const disk = getDiskSpace();
  const statusData = {
    cpuSerialNumber,
    ethMac,
    wifiMac,
    myIpAddress: getIpAddress(),
    version: '1.0.0',
    platform_version: 'mySignage-Player',
    piTemperature: getCpuTemp(),
    uptime: (os.uptime() / 3600).toFixed(1) + 'h',
    diskSpaceUsed: disk.used,
    diskSpaceAvailable: disk.available,
    currentPlaylist: state.playlist?.name || '',
    playlistOn: !!state.playlist,
    tvStatus,
  };

  socket.emit('status', {}, statusData, 0);
}

function guessType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.mp4', '.webm', '.mkv', '.avi', '.mov'].includes(ext)) return 'video';
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) return 'image';
  if (['.html', '.htm'].includes(ext)) return 'html';
  if (ext === '.pdf') return 'pdf';
  return 'other';
}

// ─── Start ───────────────────────────────────────────────
connectToServer();
console.log('[Player] mySignage Player started');
