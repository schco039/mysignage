const mongoose = require('mongoose');

const displayGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    deployedPlaylists: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Playlist',
      },
    ],
    deployedAssets: [
      {
        asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
        filename: String,
      },
    ],
    lastDeployed: Date,

    // piSignage-compatible display settings
    orientation: {
      type: String,
      enum: ['landscape', 'portrait'],
      default: 'landscape',
    },
    resolution: {
      type: String,
      default: 'auto',
    },
    signageBackgroundColor: {
      type: String,
      default: '#000',
    },
    ticker: {
      enable: { type: Boolean, default: false },
      text: { type: String, default: '' },
      speed: { type: Number, default: 3 },
    },
    sleep: {
      enable: { type: Boolean, default: false },
      ontime: { type: String, default: '07:00' },
      offtime: { type: String, default: '23:00' },
    },
    reboot: {
      enable: { type: Boolean, default: false },
      time: { type: String, default: '03:00' },
    },
    logo: { type: String, default: '' },
    logox: { type: Number, default: 10 },
    logoy: { type: Number, default: 10 },
    omxVolume: { type: Number, default: 100 },
    enableMpv: { type: Boolean, default: false },
    animationEnable: { type: Boolean, default: false },
    resizeAssets: { type: Boolean, default: true },
    videoKeepAspect: { type: Boolean, default: false },
    urlReloadDisable: { type: Boolean, default: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DisplayGroup', displayGroupSchema);
