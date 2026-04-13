const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      trim: true,
      default: '',
    },
    entityType: {
      type: String,
      enum: ['Book', 'Issue', 'Fine', 'Reservation', 'Review', 'User', 'System'],
      default: 'System',
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    ip: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
