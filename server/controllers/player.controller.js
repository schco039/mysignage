const Player = require('../models/Player');
const Asset = require('../models/Asset');
const { emitToPlayer } = require('../socket/emitter');
const fs = require('fs');
const path = require('path');
const config = require('../config');

exports.list = async (req, res) => {
  try {
    let query = {};
    if (req.allowedDisplayGroups) {
      query['displayGroup._id'] = { $in: req.allowedDisplayGroups };
    }
    const players = await Player.find(query).sort({ lastReported: -1 });
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, displayGroup, location, TZ, note, labels, defaultScreen, directAssets } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (displayGroup !== undefined) update.displayGroup = displayGroup;
    if (location !== undefined) update.location = location;
    if (TZ !== undefined) update.TZ = TZ;
    if (note !== undefined) update.note = note;
    if (labels !== undefined) update.labels = labels;
    if (defaultScreen !== undefined) update.defaultScreen = defaultScreen;
    if (directAssets !== undefined) update.directAssets = directAssets;

    const player = await Player.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const player = await Player.findByIdAndDelete(req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json({ message: 'Player deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.shell = async (req, res) => {
  try {
    const { cmd } = req.body;
    if (!cmd) return res.status(400).json({ error: 'cmd is required' });

    const ioInstances = req.app.get('ioInstances');
    const sent = await emitToPlayer(ioInstances, req.params.id, 'shell', { cmd });
    if (!sent) return res.status(404).json({ error: 'Player not connected' });
    res.json({ message: 'Shell command sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.screenshot = async (req, res) => {
  try {
    const ioInstances = req.app.get('ioInstances');
    const sent = await emitToPlayer(ioInstances, req.params.id, 'snapshot', {});
    if (!sent) return res.status(404).json({ error: 'Player not connected' });
    res.json({ message: 'Screenshot requested' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.reboot = async (req, res) => {
  try {
    const ioInstances = req.app.get('ioInstances');
    const sent = await emitToPlayer(ioInstances, req.params.id, 'shell', {
      cmd: 'sudo reboot',
    });
    if (!sent) return res.status(404).json({ error: 'Player not connected' });
    res.json({ message: 'Reboot command sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deploy = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id).populate('directAssets.asset');
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (!player.directAssets || player.directAssets.length === 0) {
      return res.status(400).json({ error: 'No direct assets assigned to this player' });
    }
    if (!player.isConnected) {
      return res.status(400).json({ error: 'Player is not connected' });
    }

    // Build config with direct assets as a single playlist
    const assets = player.directAssets
      .filter((da) => da.asset)
      .map((da) => ({
        filename: da.asset.filename,
        duration: da.duration || da.asset.duration || 10,
        type: da.asset.type,
        option: { filename: da.asset.filename, duration: da.duration || da.asset.duration || 10, selected: true },
      }));

    const configPayload = {
      name: player.name || 'Direct',
      playlists: [
        {
          name: 'Direct Assets',
          settings: { layout: '1' },
          assets,
        },
      ],
      assets: assets.map((a) => ({ filename: a.filename })),
      defaultScreen: player.defaultScreen || 'modern',
    };

    // Sync files to player sync folder
    const syncPath = path.join(config.syncDir, player.cpuSerialNumber || player._id.toString());
    fs.mkdirSync(syncPath, { recursive: true });

    const validFiles = new Set(assets.map((a) => a.filename));
    for (const filename of validFiles) {
      const src = path.join(config.mediaDir, filename);
      const dest = path.join(syncPath, filename);
      if (!fs.existsSync(src) || fs.existsSync(dest)) continue;
      try { fs.linkSync(src, dest); } catch { fs.copyFileSync(src, dest); }
    }
    // Clean old files
    const existing = fs.readdirSync(syncPath);
    for (const file of existing) {
      if (!validFiles.has(file)) fs.unlinkSync(path.join(syncPath, file));
    }

    const ioInstances = req.app.get('ioInstances');
    const sent = await emitToPlayer(ioInstances, req.params.id, 'config', configPayload);
    if (!sent) return res.status(404).json({ error: 'Player not connected' });

    res.json({ message: 'Deployed', assets: assets.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.tvPower = async (req, res) => {
  try {
    const { on } = req.body;
    const ioInstances = req.app.get('ioInstances');
    const sent = await emitToPlayer(ioInstances, req.params.id, 'cmd', {
      cmd: 'tvpower',
      args: { on: !!on },
    });
    if (!sent) return res.status(404).json({ error: 'Player not connected' });
    res.json({ message: `TV power ${on ? 'on' : 'off'} sent` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
