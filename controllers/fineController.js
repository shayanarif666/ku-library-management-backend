const asyncHandler = require('express-async-handler');
const Fine = require('../models/Fine');
const { log } = require('../utils/activityLogger');

// @desc    Get fines (admin: all | student: own)
// @route   GET /api/fines
// @access  Private
const getFines = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 15 } = req.query;
  const query = {};

  if (req.user.role === 'student') query.user = req.user._id;
  if (status) query.status = status;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [fines, total] = await Promise.all([
    Fine.find(query)
      .populate('book', 'title author ISBN')
      .populate('user', 'name email studentId')
      .populate('issue', 'issueDate dueDate returnDate')
      .populate('collectedBy', 'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum),
    Fine.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: fines,
    pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
  });
});

// @desc    Get single fine
// @route   GET /api/fines/:id
// @access  Private
const getFine = asyncHandler(async (req, res) => {
  const query = { _id: req.params.id };
  if (req.user.role === 'student') query.user = req.user._id;

  const fine = await Fine.findOne(query)
    .populate('book', 'title author ISBN')
    .populate('user', 'name email studentId')
    .populate('issue', 'issueDate dueDate returnDate');

  if (!fine) {
    res.status(404);
    throw new Error('Fine not found');
  }

  res.json({ success: true, data: fine });
});

// @desc    Mark fine as paid
// @route   PUT /api/fines/:id/pay
// @access  Admin
const markFinePaid = asyncHandler(async (req, res) => {
  const fine = await Fine.findById(req.params.id).populate('user', 'name');

  if (!fine) {
    res.status(404);
    throw new Error('Fine not found');
  }
  if (fine.status === 'paid') {
    res.status(400);
    throw new Error('Fine is already marked as paid');
  }

  fine.status = 'paid';
  fine.paidAt = new Date();
  fine.collectedBy = req.user._id;
  await fine.save();

  await log({
    userId: req.user._id,
    action: 'FINE_PAID',
    details: `Fine of $${fine.amount} marked as paid for user: ${fine.user.name}`,
    entityType: 'Fine',
    entityId: fine._id,
    ip: req.ip,
  });

  res.json({ success: true, data: fine });
});

// @desc    Get fine summary for a user
// @route   GET /api/fines/summary
// @access  Private
const getFineSummary = asyncHandler(async (req, res) => {
  const userId = req.user.role === 'student' ? req.user._id : req.query.userId || req.user._id;

  const result = await Fine.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: '$status',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const summary = { unpaid: { total: 0, count: 0 }, paid: { total: 0, count: 0 } };
  result.forEach((r) => {
    summary[r._id] = { total: r.total, count: r.count };
  });

  res.json({ success: true, data: summary });
});

module.exports = { getFines, getFine, markFinePaid, getFineSummary };
