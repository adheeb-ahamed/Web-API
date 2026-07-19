const mongoose = require('mongoose');

const pingSchema = new mongoose.Schema(
  {
    ping_id: {
      type: Number,
      required: true,
      unique: true
    },
    vehicle_id: {
      type: Number,
      required: true,
      index: true
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    speed: {
      type: Number,
      required: true,
      min: 0
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    versionKey: false
  }
);

module.exports = mongoose.model('Ping', pingSchema);
