const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
    },
    ISBN: {
      type: String,
      required: [true, 'ISBN is required'],
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    publisher: {
      type: String,
      trim: true,
      default: '',
    },
    edition: {
      type: String,
      trim: true,
      default: '',
    },
    year: {
      type: Number,
    },
    language: {
      type: String,
      default: 'English',
      trim: true,
    },
    pages: {
      type: Number,
    },
    totalCopies: {
      type: Number,
      required: [true, 'Total copies is required'],
      min: [1, 'Must have at least 1 copy'],
      default: 1,
    },
    availableCopies: {
      type: Number,
      min: [0, 'Available copies cannot be negative'],
      default: 1,
    },
    coverImage: {
      public_id: { type: String, default: '' },
      url: { type: String, default: '' },
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes for search performance
bookSchema.index({ title: 'text', author: 'text', ISBN: 'text' });
bookSchema.index({ category: 1 });
bookSchema.index({ availableCopies: 1 });

module.exports = mongoose.model('Book', bookSchema);
