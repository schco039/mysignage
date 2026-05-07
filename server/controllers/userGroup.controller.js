const UserGroup = require('../models/UserGroup');
const User = require('../models/User');
const { invalidatePermCache } = require('../middleware/rbac');

exports.list = async (req, res) => {
  try {
    const groups = await UserGroup.find()
      .populate('members', 'username email role')
      .populate('displayGroups', 'name');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const group = await UserGroup.findById(req.params.id)
      .populate('members', 'username email role')
      .populate('displayGroups', 'name');
    if (!group) return res.status(404).json({ error: 'UserGroup not found' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, description, displayGroups, members } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const group = await UserGroup.create({
      name,
      description,
      displayGroups: displayGroups || [],
      members: members || [],
      createdBy: req.user._id,
    });

    // Sync: add this group to each member's userGroups array
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
    const { name, description, displayGroups, members } = req.body;
    const group = await UserGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'UserGroup not found' });

    const oldMembers = group.members.map((m) => m.toString());

    if (name !== undefined) group.name = name;
    if (description !== undefined) group.description = description;
    if (displayGroups !== undefined) group.displayGroups = displayGroups;
    if (members !== undefined) {
      group.members = members;

      // Remove group from old members not in new list
      const removed = oldMembers.filter((m) => !members.includes(m));
      if (removed.length > 0) {
        await User.updateMany(
          { _id: { $in: removed } },
          { $pull: { userGroups: group._id } }
        );
      }
      // Add group to new members
      const added = members.filter((m) => !oldMembers.includes(m));
      if (added.length > 0) {
        await User.updateMany(
          { _id: { $in: added } },
          { $addToSet: { userGroups: group._id } }
        );
      }
    }

    await group.save();
    invalidatePermCache(); // clear all cached permissions

    const populated = await UserGroup.findById(group._id)
      .populate('members', 'username email role')
      .populate('displayGroups', 'name');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const group = await UserGroup.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ error: 'UserGroup not found' });

    // Remove group from all members
    await User.updateMany(
      { _id: { $in: group.members } },
      { $pull: { userGroups: group._id } }
    );
    invalidatePermCache();

    res.json({ message: 'UserGroup deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
