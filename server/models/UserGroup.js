const mongoose = require('mongoose');

const userGroupSchema = new mongoose.Schema(
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
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // TV Sleep/CEC Zeiten für alle Player dieser Gruppe
    sleep: {
      enable: { type: Boolean, default: false },
      ontime: { type: String, default: '07:00' },
      offtime: { type: String, default: '23:00' },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserGroup', userGroupSchema);
