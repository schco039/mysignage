const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      unique: true,
    },
    originalName: String,
    mimetype: String,
    size: Number,
    type: {
      type: String,
      enum: ['video', 'image', 'html', 'pdf', 'link', 'other'],
      default: 'other',
    },
    thumbnail: String,
    duration: {
      type: Number,
      default: 10,
    },
    validity: {
      enabled: { type: Boolean, default: false },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    userGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserGroup',
    },
    displayGroups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DisplayGroup',
      },
    ],
    labels: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Asset', assetSchema);
