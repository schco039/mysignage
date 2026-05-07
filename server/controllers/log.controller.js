const Log = require('../models/Log');

exports.list = async (req, res) => {
  try {
    const { type, player, displayGroup, limit = 200 } = req.query;
    const query = {};
    if (type) query.type = type;
    if (player) query.player = { $regex: player, $options: 'i' };
    if (displayGroup) query.displayGroup = { $regex: displayGroup, $options: 'i' };

    const logs = await Log.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 500));

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.clear = async (req, res) => {
  try {
    await Log.deleteMany({});
    res.json({ message: 'Logs cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
