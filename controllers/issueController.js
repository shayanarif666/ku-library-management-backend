const asyncHandler = require('express-async-handler');
const Issue = require('../models/Issue');
const Book = require('../models/Book');
const User = require('../models/User');
const Fine = require('../models/Fine');
const Reservation = require('../models/Reservation');
const { generateFine } = require('../utils/fineCalculator');
const { sendEmail, emailTemplates } = require('../utils/emailService');
const { log } = require('../utils/activityLogger');

const BORROW_DAYS = parseInt(process.env.BORROW_DURATION_DAYS) || 14;
const RESERVATION_EXPIRY_HOURS = parseInt(process.env.RESERVATION_EXPIRY_HOURS) || 48;

// @desc    Get issues (admin: all | student: own)
// @route   GET /api/issues
// @access  Private
const getIssues = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 15 } = req.query;
  const query = {};

  if (req.user.role === 'student') query.user = req.user._id;
  if (status) query.status = status;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [issues, total] = await Promise.all([
    Issue.find(query)
      .populate('book', 'title author ISBN coverImage')
      .populate('user', 'name email studentId')
      .populate('processedBy', 'name')
      .sort('-requestDate')
      .skip(skip)
      .limit(limitNum),
    Issue.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: issues,
    pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
  });
});

// @desc    Get overdue issues
// @route   GET /api/issues/overdue
// @access  Admin
const getOverdueIssues = asyncHandler(async (req, res) => {
  const issues = await Issue.find({
    status: 'issued',
    dueDate: { $lt: new Date() },
  })
    .populate('book', 'title author ISBN')
    .populate('user', 'name email studentId department')
    .sort('dueDate');

  res.json({ success: true, data: issues, total: issues.length });
});

// @desc    Request book issue
// @route   POST /api/issues
// @access  Student
const requestIssue = asyncHandler(async (req, res) => {
  const { bookId } = req.body;
  if (!bookId) {
    res.status(400);
    throw new Error('Book ID is required');
  }

  const [book, user] = await Promise.all([
    Book.findOne({ _id: bookId, isDeleted: false }),
    User.findById(req.user._id),
  ]);

  if (!book) {
    res.status(404);
    throw new Error('Book not found');
  }

  // Check borrow limit
  const activeIssues = await Issue.countDocuments({
    user: user._id,
    status: { $in: ['pending', 'approved', 'issued'] },
  });

  if (activeIssues >= user.maxBorrowLimit) {
    res.status(400);
    throw new Error(`You have reached your maximum borrow limit of ${user.maxBorrowLimit} books`);
  }

  // Check for existing pending/active request for same book
  const existing = await Issue.findOne({
    user: user._id,
    book: bookId,
    status: { $in: ['pending', 'approved', 'issued'] },
  });

  if (existing) {
    res.status(409);
    throw new Error('You already have an active request or issue for this book');
  }

  const issue = await Issue.create({ book: bookId, user: user._id });

  await log({
    userId: user._id,
    action: 'ISSUE_REQUESTED',
    details: `Requested book: ${book.title}`,
    entityType: 'Issue',
    entityId: issue._id,
    ip: req.ip,
  });

  const populated = await issue.populate([
    { path: 'book', select: 'title author ISBN coverImage' },
    { path: 'user', select: 'name email' },
  ]);

  res.status(201).json({ success: true, data: populated });
});

// @desc    Approve issue request
// @route   PUT /api/issues/:id/approve
// @access  Admin
const approveIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id).populate('book user');

  if (!issue) {
    res.status(404);
    throw new Error('Issue request not found');
  }
  if (issue.status !== 'pending') {
    res.status(400);
    throw new Error('Only pending requests can be approved');
  }
  if (issue.book.availableCopies < 1) {
    res.status(400);
    throw new Error('No copies available');
  }

  const issueDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + BORROW_DAYS);

  issue.status = 'issued';
  issue.issueDate = issueDate;
  issue.dueDate = dueDate;
  issue.processedBy = req.user._id;
  await issue.save();

  // Decrement available copies
  await Book.findByIdAndUpdate(issue.book._id, { $inc: { availableCopies: -1 } });

  // Send email notification
  const { subject, html } = emailTemplates.issueApproved(issue.user.name, issue.book.title, dueDate);
  sendEmail(issue.user.email, subject, html);

  // Emit socket event
  const io = req.app.get('io');
  io.to(issue.user._id.toString()).emit('issueApproved', {
    bookTitle: issue.book.title,
    dueDate,
  });

  await log({
    userId: req.user._id,
    action: 'ISSUE_APPROVED',
    details: `Approved issue for: ${issue.book.title} — User: ${issue.user.name}`,
    entityType: 'Issue',
    entityId: issue._id,
    ip: req.ip,
  });

  res.json({ success: true, data: issue });
});

// @desc    Reject issue request
// @route   PUT /api/issues/:id/reject
// @access  Admin
const rejectIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id).populate('book user');

  if (!issue) {
    res.status(404);
    throw new Error('Issue request not found');
  }
  if (issue.status !== 'pending') {
    res.status(400);
    throw new Error('Only pending requests can be rejected');
  }

  issue.status = 'rejected';
  issue.processedBy = req.user._id;
  issue.notes = req.body.notes || '';
  await issue.save();

  await log({
    userId: req.user._id,
    action: 'ISSUE_REJECTED',
    details: `Rejected issue for: ${issue.book.title} — User: ${issue.user.name}`,
    entityType: 'Issue',
    entityId: issue._id,
    ip: req.ip,
  });

  res.json({ success: true, data: issue });
});

// @desc    Return book
// @route   PUT /api/issues/:id/return
// @access  Admin
const returnBook = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id).populate('book user');

  if (!issue) {
    res.status(404);
    throw new Error('Issue not found');
  }
  if (issue.status !== 'issued') {
    res.status(400);
    throw new Error('Only issued books can be returned');
  }

  const returnDate = new Date();
  issue.status = 'returned';
  issue.returnDate = returnDate;
  issue.processedBy = req.user._id;
  await issue.save();

  // Increment available copies
  await Book.findByIdAndUpdate(issue.book._id, { $inc: { availableCopies: 1 } });

  // Generate fine if overdue
  let fine = null;
  if (!issue.fineGenerated) {
    fine = await generateFine(issue);
  }

  // Fulfill next reservation in queue
  const nextReservation = await Reservation.findOne({
    book: issue.book._id,
    status: 'active',
  })
    .sort('queuePosition')
    .populate('user', 'name email');

  if (nextReservation) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + RESERVATION_EXPIRY_HOURS);
    nextReservation.notifiedAt = new Date();
    nextReservation.expiresAt = expiresAt;
    await nextReservation.save();

    const { subject, html } = emailTemplates.reservationAvailable(
      nextReservation.user.name,
      issue.book.title,
      expiresAt
    );
    sendEmail(nextReservation.user.email, subject, html);

    const io = req.app.get('io');
    io.to(nextReservation.user._id.toString()).emit('reservationAvailable', {
      bookTitle: issue.book.title,
    });
  }

  await log({
    userId: req.user._id,
    action: 'BOOK_RETURNED',
    details: `Returned: ${issue.book.title} — User: ${issue.user.name}${fine ? ` — Fine: $${fine.amount}` : ''}`,
    entityType: 'Issue',
    entityId: issue._id,
    ip: req.ip,
  });

  res.json({ success: true, data: { issue, fine } });
});

// @desc    Get single issue
// @route   GET /api/issues/:id
// @access  Private
const getIssue = asyncHandler(async (req, res) => {
  const query = { _id: req.params.id };
  if (req.user.role === 'student') query.user = req.user._id;

  const issue = await Issue.findOne(query)
    .populate('book', 'title author ISBN coverImage category')
    .populate('user', 'name email studentId')
    .populate('processedBy', 'name');

  if (!issue) {
    res.status(404);
    throw new Error('Issue not found');
  }

  res.json({ success: true, data: issue });
});

module.exports = { getIssues, getOverdueIssues, requestIssue, approveIssue, rejectIssue, returnBook, getIssue };
