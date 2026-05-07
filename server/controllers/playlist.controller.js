const Playlist = require('../models/Playlist');
const { deployDisplayGroup } = require('../services/deploy.service');

exports.list = async (req, res) => {
  try {
    let query = {};
    if (req.allowedDisplayGroups) {
      query.displayGroup = { $in: req.allowedDisplayGroups };
    }
    if (req.query.displayGroup) {
      query.displayGroup = req.query.displayGroup;
    }

    const playlists = await Playlist.find(query)
      .populate('displayGroup', 'name')
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
      .populate('displayGroup', 'name')
      .populate('assets.asset', 'filename originalName type thumbnail duration mimetype')
      .populate('userGroup', 'name')
      .populate('createdBy', 'username');
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    if (
      req.allowedDisplayGroups &&
      !req.allowedDisplayGroups.includes(playlist.displayGroup._id.toString())
    ) {
      return res.status(403).json({ error: 'No access to this playlist' });
    }

    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, displayGroup, assets, schedule, settings, userGroup, targetPlayers } = req.body;
    if (!name || !displayGroup) {
      return res.status(400).json({ error: 'name and displayGroup are required' });
    }

    const playlist = await Playlist.create({
      name,
      displayGroup,
      assets: assets || [],
      schedule: schedule || {},
      settings: settings || {},
      targetPlayers: targetPlayers || [],
      userGroup: userGroup || null,
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

    if (
      req.allowedDisplayGroups &&
      !req.allowedDisplayGroups.includes(playlist.displayGroup.toString())
    ) {
      return res.status(403).json({ error: 'No access to this playlist' });
    }

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

exports.deploy = async (req, res) => {
  try {
    const displayGroupId = req.params.displayGroupId;
    if (
      req.allowedDisplayGroups &&
      !req.allowedDisplayGroups.includes(displayGroupId)
    ) {
      return res.status(403).json({ error: 'No access to this display group' });
    }

    const io = req.app.get('io');
    const { playerIds } = req.body || {};
    const result = await deployDisplayGroup(displayGroupId, io, playerIds || null);
    res.json({ message: 'Deploy successful', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
