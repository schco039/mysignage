const User = require('../models/User');
const { invalidatePermCache } = require('../middleware/rbac');

exports.list = async (req, res) => {
  try {
    const users = await User.find().populate('userGroups', 'name');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('userGroups', 'name');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password are required' });
    }
    const user = await User.create({
      username,
      email,
      passwordHash: password,
      role: role || 'editor',
      mustChangePassword: true, // neue User müssen Passwort beim ersten Login ändern
    });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { role, email, userGroups } = req.body;
    const update = {};
    if (role) update.role = role;
    if (email) update.email = email;
    if (userGroups) update.userGroups = userGroups;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).populate(
      'userGroups',
      'name'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    invalidatePermCache(user._id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    invalidatePermCache(user._id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
