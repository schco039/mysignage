const Asset = require('../models/Asset');
const Playlist = require('../models/Playlist');
const DisplayGroup = require('../models/DisplayGroup');

/**
 * piSignage compatibility controller.
 * Translates mySignage data to piSignage response format.
 */

// GET /api/files - list assets in piSignage format
exports.listFiles = async (req, res) => {
  try {
    const assets = await Asset.find().sort({ createdAt: -1 });
    const files = assets.map((a) => ({
      name: a.filename,
      size: a.size,
      type: a.mimetype,
      ctime: a.createdAt,
      thumbnail: a.thumbnail ? `/media/${a.thumbnail}` : null,
    }));
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/files/:file - get asset detail
exports.getFile = async (req, res) => {
  try {
    const asset = await Asset.findOne({ filename: req.params.file });
    if (!asset) return res.status(404).json({ error: 'File not found' });
    res.json({
      name: asset.filename,
      size: asset.size,
      type: asset.mimetype,
      ctime: asset.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/playlists - list playlists in piSignage format
exports.listPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find()
      .populate('assets.asset', 'filename type duration')
      .sort({ createdAt: 1 });

    const result = playlists.map((p) => ({
      name: p.name,
      settings: p.settings,
      assets: p.assets
        .filter((a) => a.asset)
        .map((a) => ({
          filename: a.asset.filename,
          duration: a.duration || a.asset.duration || 10,
          selected: a.option ? a.option.selected : true,
        })),
    }));
    res.json({ playlists: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/playlists/:name - get playlist detail
exports.getPlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ name: req.params.name })
      .populate('assets.asset', 'filename type duration');
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    res.json({
      name: playlist.name,
      settings: playlist.settings,
      assets: playlist.assets
        .filter((a) => a.asset)
        .map((a) => ({
          filename: a.asset.filename,
          duration: a.duration || a.asset.duration || 10,
          selected: a.option ? a.option.selected : true,
        })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/groups - list display groups in piSignage format
exports.listGroups = async (req, res) => {
  try {
    const groups = await DisplayGroup.find();
    const result = groups.map((g) => ({
      _id: g._id,
      name: g.name,
      orientation: g.orientation,
      resolution: g.resolution,
      deployedPlaylists: g.deployedPlaylists,
      lastDeployed: g.lastDeployed,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/groups/:id - get display group detail
exports.getGroup = async (req, res) => {
  try {
    const group = await DisplayGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/settings - server settings
exports.getSettings = async (req, res) => {
  res.json({
    server: 'mySignage',
    version: '1.0.0',
    currentTime: new Date().toISOString(),
  });
};
