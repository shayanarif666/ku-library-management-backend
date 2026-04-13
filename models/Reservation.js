const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'fulfilled', 'cancelled', 'expired'],
      default: 'active',
    },
    queuePosition: {
      type: Number,
      required: true,
    },
    reservedAt: {
      type: Date,
      default: Date.now,
    },
    notifiedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Unique: one active reservation per user per book
reservationSchema.index(
  { book: 1, user: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
  }
);

reservationSchema.index({ book: 1, status: 1, queuePosition: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
