const asyncHandler = require('express-async-handler');
const Review = require('../models/Review');
const Issue = require('../models/Issue');
const { log } = require('../utils/activityLogger');

// @desc    Get reviews for a book
// @route   GET /api/reviews/book/:bookId
// @access  Public
const getBookReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(20, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [reviews, total] = await Promise.all([
    Review.find({ book: req.params.bookId })
      .populate('user', 'name avatar')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum),
    Review.countDocuments({ book: req.params.bookId }),
  ]);

  res.json({
    success: true,
    data: reviews,
    pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
  });
});

// @desc    Add a review
// @route   POST /api/reviews
// @access  Student (must have returned the book)
const addReview = asyncHandler(async (req, res) => {
  const { bookId, rating, comment } = req.body;

  if (!bookId || !rating) {
    res.status(400);
    throw new Error('Book ID and rating are required');
  }

  // Only allow review if user has returned the book
  const returnedIssue = await Issue.findOne({
    user: req.user._id,
    book: bookId,
    status: 'returned',
  });

  if (!returnedIssue) {
    res.status(403);
    throw new Error('You can only review books you have borrowed and returned');
  }

  const review = await Review.create({
    book: bookId,
    user: req.user._id,
    rating: parseInt(rating),
    comment,
  });

  const populated = await review.populate('user', 'name avatar');

  await log({
    userId: req.user._id,
    action: 'REVIEW_ADDED',
    details: `Reviewed book (rating: ${rating})`,
    entityType: 'Review',
    entityId: review._id,
    ip: req.ip,
  });

  res.status(201).json({ success: true, data: populated });
});

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Student (own)
const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findOne({ _id: req.params.id, user: req.user._id });

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  if (req.body.rating) review.rating = parseInt(req.body.rating);
  if (req.body.comment !== undefined) review.comment = req.body.comment;
  await review.save();

  res.json({ success: true, data: review });
});

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Student (own) | Admin
const deleteReview = asyncHandler(async (req, res) => {
  const query = { _id: req.params.id };
  if (req.user.role === 'student') query.user = req.user._id;

  const review = await Review.findOne(query);
  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  await review.deleteOne();
  res.json({ success: true, message: 'Review deleted' });
});

module.exports = { getBookReviews, addReview, updateReview, deleteReview };
