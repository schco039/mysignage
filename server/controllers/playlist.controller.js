const Playlist = require('../models/Playlist');
const Player = require('../models/Player');
const { deployPlayerIds } = require('../services/deploy.service');

exports.list = async (req, res) => {
  try {
    let query = {};
    // Editoren sehen nur Playlists ihrer UserGroups
    if (req.userGroupIds) {
      query.userGroup = { $in: req.userGroupIds };
    }

    const playlists = await Playlist.find(query)
      .populate('assets.asset', 'filename originalName type thumbnail duration')
      .populate('targetPlayers', 'name cpuSerialNumber')
      .populate('userGroup', 'name')
      .sort({ createdAt: 1 });
    res.json(playlists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('assets.asset', 'filename originalName type thumbnail duration mimetype')
      .populate('userGroup', 'name')
      .populate('createdBy', 'username');
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, assets, schedule, settings, userGroup, targetPlayers } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    // Wenn kein userGroup übergeben → erste UserGroup des Editors nehmen
    const resolvedUserGroup = userGroup || (req.userGroupIds && req.userGroupIds[0]) || null;

    const playlist = await Playlist.create({
      name,
      assets: assets || [],
      schedule: schedule || {},
      settings: settings || {},
      targetPlayers: targetPlayers || [],
      userGroup: resolvedUserGroup,
      createdBy: req.user._id,
    });

    res.status(201).json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    const { name, assets, schedule, settings, targetPlayers } = req.body;
    if (name !== undefined) playlist.name = name;
    if (assets !== undefined) playlist.assets = assets;
    if (schedule !== undefined) playlist.schedule = schedule;
    if (settings !== undefined) playlist.settings = settings;
    if (targetPlayers !== undefined) playlist.targetPlayers = targetPlayers;

    await playlist.save();
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    if (
      req.userGroupIds &&
      playlist.userGroup &&
      !req.userGroupIds.includes(playlist.userGroup.toString())
    ) {
      return res.status(403).json({ error: 'Can only delete your own group\'s playlists' });
    }

    await Playlist.findByIdAndDelete(req.params.id);
    res.json({ message: 'Playlist deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Deploy an eine Liste von Player-IDs (vom Schedule aufgerufen)
exports.deployToPlayers = async (req, res) => {
  try {
    const { playerIds } = req.body || {};
    if (!playerIds || playerIds.length === 0) {
      return res.status(400).json({ error: 'playerIds required' });
    }
    const io = req.app.get('io');
    await deployPlayerIds(playerIds, io);
    res.json({ message: 'Deploy successful', players: playerIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
