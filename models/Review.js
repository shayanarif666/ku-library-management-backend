const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
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
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
      default: '',
    },
  },
  { timestamps: true }
);

// One review per user per book
reviewSchema.index({ book: 1, user: 1 }, { unique: true });

// After save, update book's average rating
reviewSchema.post('save', async function () {
  const Book = mongoose.model('Book');
  const stats = await mongoose.model('Review').aggregate([
    { $match: { book: this.book } },
    { $group: { _id: '$book', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (stats.length > 0) {
    await Book.findByIdAndUpdate(this.book, {
      averageRating: Math.round(stats[0].avg * 10) / 10,
      ratingCount: stats[0].count,
    });
  }
});

module.exports = mongoose.model('Review', reviewSchema);
