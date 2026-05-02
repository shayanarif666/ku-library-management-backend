const asyncHandler = require('express-async-handler');
const Review = require('../models/Review');
const Issue = require('../models/Issue');
const { log } = require('../utils/activityLogger');

// @desc    Get reviews for a book
// @route   GET /api/reviews/book/:bookId
// @access  Public (only approved) | Admin (all when ?all=true)
const getBookReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, all = 'false' } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(20, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const isAdmin = req.user && ['admin', 'superadmin'].includes(req.user.role);
  const showAll = isAdmin && all === 'true';

  const query = { book: req.params.bookId };
  if (!showAll) query.isApproved = true;

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate('user', 'name avatar')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum),
    Review.countDocuments(query),
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
    isApproved: false, // pending admin approval
  });

  const populated = await review.populate('user', 'name avatar');

  await log({
    userId: req.user._id,
    action: 'REVIEW_ADDED',
    details: `Reviewed book (rating: ${rating}) — pending approval`,
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
  // Reset approval on edit so admin re-checks
  review.isApproved = false;
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

// @desc    Get latest approved reviews across all books (for Home page)
// @route   GET /api/reviews/recent?limit=6
// @access  Public
const getRecentReviews = asyncHandler(async (req, res) => {
  const limit = Math.min(12, parseInt(req.query.limit) || 6);
  const reviews = await Review.find({ isApproved: true, comment: { $ne: '' } })
    .populate('user', 'name')
    .populate('book', 'title author')
    .sort('-createdAt')
    .limit(limit);
  res.json({ success: true, data: reviews });
});

module.exports = { getBookReviews, addReview, updateReview, deleteReview, getRecentReviews };
