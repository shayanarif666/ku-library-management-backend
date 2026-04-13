const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book is required'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'issued', 'returned', 'rejected'],
      default: 'pending',
    },
    requestDate: {
      type: Date,
      default: Date.now,
    },
    issueDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    returnDate: {
      type: Date,
    },
    renewalCount: {
      type: Number,
      default: 0,
      max: 2,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    fineGenerated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

issueSchema.index({ user: 1, status: 1 });
issueSchema.index({ book: 1, status: 1 });
issueSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model('Issue', issueSchema);
