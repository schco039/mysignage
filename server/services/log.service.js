const Log = require('../models/Log');

async function log(type, message, opts = {}) {
  try {
    await Log.create({
      type,
      message,
      player: opts.player || null,
      playerId: opts.playerId || null,
      displayGroup: opts.displayGroup || null,
      details: opts.details || null,
    });
  } catch (err) {
    console.error('Log write error:', err.message);
  }
}

module.exports = { log };
