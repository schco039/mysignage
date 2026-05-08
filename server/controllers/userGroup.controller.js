const UserGroup = require('../models/UserGroup');
const User = require('../models/User');
const Player = require('../models/Player');
const { invalidatePermCache } = require('../middleware/rbac');

exports.list = async (req, res) => {
  try {
    const groups = await UserGroup.find()
      .populate('members', 'username email role')
      .lean();

    // Player pro Gruppe ermitteln
    for (const group of groups) {
      group.players = await Player.find({ userGroups: group._id })
        .select('name cpuSerialNumber')
        .lean();
    }
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const group = await UserGroup.findById(req.params.id)
      .populate('members', 'username email role')
      .lean();
    if (!group) return res.status(404).json({ error: 'UserGroup not found' });
    group.players = await Player.find({ userGroups: group._id })
      .select('name cpuSerialNumber')
      .lean();
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, description, members, sleep } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const group = await UserGroup.create({
      name,
      description,
      members: members || [],
      sleep: sleep || undefined,
      createdBy: req.user._id,
    });

    if (members && members.length > 0) {
      await User.updateMany(
        { _id: { $in: members } },
        { $addToSet: { userGroups: group._id } }
      );
      members.forEach((id) => invalidatePermCache(id));
    }

    res.status(201).json(group);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'UserGroup name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, description, members, sleep } = req.body;
    const group = await UserGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'UserGroup not found' });

    const oldMembers = group.members.map((m) => m.toString());

    if (name !== undefined) group.name = name;
    if (description !== undefined) group.description = description;
    if (sleep !== undefined) group.sleep = sleep;
    if (members !== undefined) {
      group.members = members;
      const removed = oldMembers.filter((m) => !members.includes(m));
      if (removed.length > 0) {
        await User.updateMany(
          { _id: { $in: removed } },
          { $pull: { userGroups: group._id } }
        );
      }
      const added = members.filter((m) => !oldMembers.includes(m));
      if (added.length > 0) {
        await User.updateMany(
          { _id: { $in: added } },
          { $addToSet: { userGroups: group._id } }
        );
      }
    }

    await group.save();
    invalidatePermCache();

    const populated = await UserGroup.findById(group._id)
      .populate('members', 'username email role')
      .lean();
    populated.players = await Player.find({ userGroups: group._id })
      .select('name cpuSerialNumber')
      .lean();
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const group = await UserGroup.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ error: 'UserGroup not found' });

    await User.updateMany(
      { _id: { $in: group.members } },
      { $pull: { userGroups: group._id } }
    );
    // Auch von Players entfernen
    await Player.updateMany(
      { userGroups: group._id },
      { $pull: { userGroups: group._id } }
    );
    invalidatePermCache();

    res.json({ message: 'UserGroup deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
