const DisplayGroup = require('../models/DisplayGroup');
const fs = require('fs');
const path = require('path');
const config = require('../config');

exports.list = async (req, res) => {
  try {
    let query = {};
    // Editors only see their allowed display groups
    if (req.allowedDisplayGroups) {
      query._id = { $in: req.allowedDisplayGroups };
    }
    const groups = await DisplayGroup.find(query).select('-deployedAssets');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const group = await DisplayGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'DisplayGroup not found' });

    // Scope check for editors
    if (req.allowedDisplayGroups && !req.allowedDisplayGroups.includes(group._id.toString())) {
      return res.status(403).json({ error: 'No access to this display group' });
    }

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const group = await DisplayGroup.create({
      ...req.body,
      createdBy: req.user._id,
    });

    // Create sync_folders directory
    const syncPath = path.join(config.syncDir, group.name);
    fs.mkdirSync(syncPath, { recursive: true });

    res.status(201).json(group);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'DisplayGroup name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const group = await DisplayGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'DisplayGroup not found' });

    if (req.allowedDisplayGroups && !req.allowedDisplayGroups.includes(group._id.toString())) {
      return res.status(403).json({ error: 'No access to this display group' });
    }

    // Don't allow changing name (it's the sync folder name)
    const { name, ...updateFields } = req.body;
    Object.assign(group, updateFields);
    await group.save();

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const group = await DisplayGroup.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ error: 'DisplayGroup not found' });
    res.json({ message: 'DisplayGroup deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
