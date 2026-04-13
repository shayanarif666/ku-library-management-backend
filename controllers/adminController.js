const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Book = require('../models/Book');
const Issue = require('../models/Issue');
const Fine = require('../models/Fine');
const ActivityLog = require('../models/ActivityLog');
const { log } = require('../utils/activityLogger');

// @desc    Get admin dashboard analytics
// @route   GET /api/admin/dashboard
// @access  Admin
const getDashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalBooks,
    totalUsers,
    totalIssued,
    overdueCount,
    pendingRequests,
    totalFinesUnpaid,
    recentIssues,
    issuesByDay,
    topCategories,
  ] = await Promise.all([
    Book.countDocuments({ isDeleted: false }),
    User.countDocuments({ role: 'student', isActive: true }),
    Issue.countDocuments({ status: 'issued' }),
    Issue.countDocuments({ status: 'issued', dueDate: { $lt: now } }),
    Issue.countDocuments({ status: 'pending' }),
    Fine.aggregate([
      { $match: { status: 'unpaid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Issue.find({ status: { $in: ['issued', 'pending'] } })
      .populate('book', 'title author coverImage')
      .populate('user', 'name email studentId')
      .sort('-requestDate')
      .limit(8),
    Issue.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Book.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        totalBooks,
        totalUsers,
        totalIssued,
        overdueCount,
        pendingRequests,
        totalFinesUnpaid: totalFinesUnpaid[0]?.total || 0,
      },
      recentIssues,
      issuesByDay,
      topCategories,
    },
  });
});

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin
const getUsers = asyncHandler(async (req, res) => {
  const { search = '', role = '', isActive = '', page = 1, limit = 15 } = req.query;
  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { studentId: { $regex: search, $options: 'i' } },
    ];
  }
  if (role) query.role = role;
  if (isActive !== '') query.isActive = isActive === 'true';

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    User.find(query).sort('-createdAt').skip(skip).limit(limitNum),
    User.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
  });
});

// @desc    Toggle user active status
// @route   PUT /api/admin/users/:id/toggle-status
// @access  Admin
const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (user.role === 'superadmin') {
    res.status(403);
    throw new Error('Cannot modify super admin status');
  }

  user.isActive = !user.isActive;
  await user.save();

  await log({
    userId: req.user._id,
    action: user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    details: `${user.isActive ? 'Activated' : 'Deactivated'} user: ${user.name}`,
    entityType: 'User',
    entityId: user._id,
    ip: req.ip,
  });

  res.json({ success: true, data: user });
});

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  SuperAdmin
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const validRoles = ['student', 'admin', 'superadmin'];

  if (!validRoles.includes(role)) {
    res.status(400);
    throw new Error('Invalid role');
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  );

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  await log({
    userId: req.user._id,
    action: 'USER_ROLE_CHANGED',
    details: `Changed role of ${user.name} to ${role}`,
    entityType: 'User',
    entityId: user._id,
    ip: req.ip,
  });

  res.json({ success: true, data: user });
});

// @desc    Get activity logs
// @route   GET /api/admin/logs
// @access  Admin
const getActivityLogs = asyncHandler(async (req, res) => {
  const { entityType = '', action = '', page = 1, limit = 20 } = req.query;
  const query = {};

  if (entityType) query.entityType = entityType;
  if (action) query.action = { $regex: action, $options: 'i' };

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [logs, total] = await Promise.all([
    ActivityLog.find(query)
      .populate('user', 'name email role')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum),
    ActivityLog.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
  });
});

module.exports = { getDashboard, getUsers, toggleUserStatus, updateUserRole, getActivityLogs };
