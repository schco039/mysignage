const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['deploy', 'download', 'connect', 'disconnect', 'error', 'cec', 'reboot', 'cron'],
      required: true,
      index: true,
    },
    player: {
      type: String, // player name or cpuSerial
      default: null,
      index: true,
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
    },
    displayGroup: {
      type: String,
      default: null,
    },
    message: {
      type: String,
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

// Auto-delete logs older than 30 days
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Log', logSchema);
