const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    cpuSerialNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    ethMac: String,
    wifiMac: String,
    name: {
      type: String,
      default: '',
    },
    displayGroup: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'DisplayGroup' },
      name: String,
    },

    // Connection state
    isConnected: {
      type: Boolean,
      default: false,
      index: true,
    },
    socket: {
      type: String,
      index: true,
    },
    newSocketIo: { type: Boolean, default: false },
    webSocket: { type: Boolean, default: false },

    // Network
    ip: String,
    myIpAddress: String,

    // System info
    version: String,
    platform_version: String,
    piTemperature: String,
    uptime: String,
    diskSpaceUsed: String,
    diskSpaceAvailable: String,

    // Playback state
    currentPlaylist: String,
    playlistOn: Boolean,
    playlistStarttime: String,
    duration: String,

    // TV / CEC
    tvStatus: Boolean,
    cecTvStatus: { type: Boolean, default: true },

    // Sync state
    syncInProgress: Boolean,
    wgetBytes: String,
    wgetSpeed: String,

    // Meta
    lastReported: Date,
    lastUpload: { type: Number, default: 0 },
    registered: { type: Boolean, default: false },
    location: String,
    TZ: String,
    note: String,
    labels: [String],
    defaultScreen: {
      type: String,
      enum: ['modern', 'testbild'],
      default: 'modern',
    },
    directAssets: [
      {
        asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
        duration: { type: Number, default: 10 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Player', playerSchema);
