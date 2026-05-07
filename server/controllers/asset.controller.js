const Asset = require('../models/Asset');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { generateThumbnail, getVideoDuration } = require('../services/thumbnail.service');

function detectType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype === 'text/html') return 'html';
  return 'other';
}

exports.list = async (req, res) => {
  try {
    let query = {};
    // Optional filter by displayGroup (not required)
    if (req.query.displayGroup) {
      query.displayGroups = req.query.displayGroup;
    }
    if (req.query.label) {
      query.labels = req.query.label;
    }
    if (req.query.type) {
      query.type = req.query.type;
    }

    const assets = await Asset.find(query)
      .populate('createdBy', 'username')
      .populate('userGroup', 'name')
      .populate('displayGroups', 'name')
      .sort({ createdAt: -1 });
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('createdBy', 'username')
      .populate('userGroup', 'name')
      .populate('displayGroups', 'name');
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    if (
      req.allowedDisplayGroups &&
      !asset.displayGroups.some((dg) => req.allowedDisplayGroups.includes(dg._id.toString()))
    ) {
      return res.status(403).json({ error: 'No access to this asset' });
    }

    res.json(asset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.upload = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { displayGroups, userGroup, labels, validity, names } = req.body;
    const parsedDisplayGroups = displayGroups ? JSON.parse(displayGroups) : [];
    const parsedLabels = labels ? JSON.parse(labels) : [];
    const parsedValidity = validity ? JSON.parse(validity) : { enabled: false };
    const parsedNames = names ? JSON.parse(names) : [];

    const assets = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const thumbnail = await generateThumbnail(file.path, file.mimetype);
      const type = detectType(file.mimetype);

      // Auto-detect video duration
      let duration = 10;
      if (type === 'video') {
        const videoDuration = getVideoDuration(file.path);
        if (videoDuration) duration = videoDuration;
      }

      // Use custom name if provided, otherwise fall back to original filename
      const displayName = parsedNames[i] || file.originalname;

      const asset = await Asset.create({
        filename: file.filename,
        originalName: displayName,
        mimetype: file.mimetype,
        size: file.size,
        type,
        thumbnail,
        duration,
        validity: parsedValidity,
        createdBy: req.user._id,
        userGroup: userGroup || null,
        displayGroups: parsedDisplayGroups,
        labels: parsedLabels,
      });
      assets.push(asset);
    }

    res.status(201).json(assets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    if (
      req.allowedDisplayGroups &&
      !asset.displayGroups.some((dg) => req.allowedDisplayGroups.includes(dg.toString()))
    ) {
      return res.status(403).json({ error: 'No access to this asset' });
    }

    const { validity, labels, displayGroups, duration } = req.body;
    if (validity !== undefined) asset.validity = validity;
    if (labels !== undefined) asset.labels = labels;
    if (displayGroups !== undefined) asset.displayGroups = displayGroups;
    if (duration !== undefined) asset.duration = duration;

    await asset.save();
    res.json(asset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    // Permission check: Admin bypasses (userGroupIds is null for admins)
    // Non-admins can delete if they are the owner OR in the same userGroup
    if (req.userGroupIds) {
      const isOwner = asset.createdBy && asset.createdBy.toString() === req.user._id.toString();
      const isSameGroup = asset.userGroup && req.userGroupIds.includes(asset.userGroup.toString());
      if (!isOwner && !isSameGroup) {
        return res.status(403).json({ error: 'Only the owner, group members, or admins can delete assets' });
      }
    }

    // Delete file from disk
    const filePath = path.join(config.mediaDir, asset.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Delete thumbnail
    if (asset.thumbnail) {
      const thumbPath = path.join(config.mediaDir, asset.thumbnail);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }

    await Asset.findByIdAndDelete(req.params.id);
    res.json({ message: 'Asset deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
