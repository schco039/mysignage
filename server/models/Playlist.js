const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    assets: [
      {
        asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
        duration: { type: Number, default: 10 },
        option: {
          filename: String,
          duration: Number,
          selected: { type: Boolean, default: true },
        },
      },
    ],
    schedule: {
      enabled: { type: Boolean, default: false },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null },
      daysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    },
    targetPlayers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
      },
    ],
    settings: {
      layout: { type: String, default: '1' },
      templateName: { type: String, default: null },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    userGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserGroup',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Playlist', playlistSchema);
