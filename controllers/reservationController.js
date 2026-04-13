const asyncHandler = require('express-async-handler');
const Reservation = require('../models/Reservation');
const Book = require('../models/Book');
const Issue = require('../models/Issue');
const { log } = require('../utils/activityLogger');

// @desc    Get reservations (admin: all | student: own)
// @route   GET /api/reservations
// @access  Private
const getReservations = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 15 } = req.query;
  const query = {};

  if (req.user.role === 'student') query.user = req.user._id;
  if (status) query.status = status;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [reservations, total] = await Promise.all([
    Reservation.find(query)
      .populate('book', 'title author ISBN coverImage availableCopies')
      .populate('user', 'name email studentId')
      .sort('-reservedAt')
      .skip(skip)
      .limit(limitNum),
    Reservation.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: reservations,
    pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
  });
});

// @desc    Reserve a book
// @route   POST /api/reservations
// @access  Student
const reserveBook = asyncHandler(async (req, res) => {
  const { bookId } = req.body;
  if (!bookId) {
    res.status(400);
    throw new Error('Book ID is required');
  }

  const book = await Book.findOne({ _id: bookId, isDeleted: false });
  if (!book) {
    res.status(404);
    throw new Error('Book not found');
  }

  // Check if user has an active issue for this book
  const activeIssue = await Issue.findOne({
    user: req.user._id,
    book: bookId,
    status: { $in: ['pending', 'approved', 'issued'] },
  });
  if (activeIssue) {
    res.status(400);
    throw new Error('You already have an active issue or request for this book');
  }

  // Check for existing active reservation
  const existingReservation = await Reservation.findOne({
    user: req.user._id,
    book: bookId,
    status: 'active',
  });
  if (existingReservation) {
    res.status(409);
    throw new Error('You already have an active reservation for this book');
  }

  // Get queue position
  const queueCount = await Reservation.countDocuments({ book: bookId, status: 'active' });

  const reservation = await Reservation.create({
    book: bookId,
    user: req.user._id,
    queuePosition: queueCount + 1,
  });

  await log({
    userId: req.user._id,
    action: 'BOOK_RESERVED',
    details: `Reserved: ${book.title} (Queue: ${queueCount + 1})`,
    entityType: 'Reservation',
    entityId: reservation._id,
    ip: req.ip,
  });

  const populated = await reservation.populate('book', 'title author ISBN coverImage');

  res.status(201).json({ success: true, data: populated });
});

// @desc    Cancel reservation
// @route   PUT /api/reservations/:id/cancel
// @access  Student (own) | Admin
const cancelReservation = asyncHandler(async (req, res) => {
  const query = { _id: req.params.id };
  if (req.user.role === 'student') query.user = req.user._id;

  const reservation = await Reservation.findOne(query).populate('book', 'title');

  if (!reservation) {
    res.status(404);
    throw new Error('Reservation not found');
  }
  if (reservation.status !== 'active') {
    res.status(400);
    throw new Error('Only active reservations can be cancelled');
  }

  reservation.status = 'cancelled';
  await reservation.save();

  // Re-number the queue for this book
  await Reservation.updateMany(
    { book: reservation.book._id, status: 'active', queuePosition: { $gt: reservation.queuePosition } },
    { $inc: { queuePosition: -1 } }
  );

  await log({
    userId: req.user._id,
    action: 'RESERVATION_CANCELLED',
    details: `Cancelled reservation for: ${reservation.book.title}`,
    entityType: 'Reservation',
    entityId: reservation._id,
    ip: req.ip,
  });

  res.json({ success: true, message: 'Reservation cancelled successfully' });
});

// @desc    Get reservation queue for a book
// @route   GET /api/reservations/book/:bookId
// @access  Admin
const getBookQueue = asyncHandler(async (req, res) => {
  const reservations = await Reservation.find({
    book: req.params.bookId,
    status: 'active',
  })
    .populate('user', 'name email studentId department')
    .sort('queuePosition');

  res.json({ success: true, data: reservations });
});

module.exports = { getReservations, reserveBook, cancelReservation, getBookQueue };
