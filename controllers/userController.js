const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Issue = require('../models/Issue');
const Fine = require('../models/Fine');
const Reservation = require('../models/Reservation');
const { cloudinary } = require('../config/cloudinary');
const { log } = require('../utils/activityLogger');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const { name, studentId, department, phone } = req.body;

  const updateData = {};
  if (name) updateData.name = name;
  if (studentId !== undefined) updateData.studentId = studentId;
  if (department !== undefined) updateData.department = department;
  if (phone !== undefined) updateData.phone = phone;

  if (req.file) {
    if (req.user.avatar?.public_id) {
      await cloudinary.uploader.destroy(req.user.avatar.public_id);
    }
    updateData.avatar = { public_id: req.file.filename, url: req.file.path };
  }

  const user = await User.findByIdAndUpdate(req.user._id, updateData, {
    new: true,
    runValidators: true,
  });

  res.json({ success: true, data: user });
});

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Current and new password are required');
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters');
  }

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password changed successfully' });
});

// @desc    Get student dashboard data
// @route   GET /api/users/dashboard
// @access  Student
const getStudentDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [activeIssues, returnHistory, unpaidFines, activeReservations] = await Promise.all([
    Issue.find({ user: userId, status: { $in: ['pending', 'approved', 'issued'] } })
      .populate('book', 'title author ISBN coverImage')
      .sort('-requestDate'),
    Issue.find({ user: userId, status: 'returned' })
      .populate('book', 'title author ISBN coverImage')
      .sort('-returnDate')
      .limit(5),
    Fine.find({ user: userId, status: 'unpaid' })
      .populate('book', 'title author')
      .sort('-createdAt'),
    Reservation.find({ user: userId, status: 'active' })
      .populate('book', 'title author ISBN coverImage availableCopies')
      .sort('queuePosition'),
  ]);

  const totalFineAmount = unpaidFines.reduce((sum, f) => sum + f.amount, 0);

  res.json({
    success: true,
    data: {
      activeIssues,
      returnHistory,
      unpaidFines,
      activeReservations,
      stats: {
        activeCount: activeIssues.length,
        returnedCount: await Issue.countDocuments({ user: userId, status: 'returned' }),
        totalFineAmount,
        reservationCount: activeReservations.length,
      },
    },
  });
});

module.exports = { getProfile, updateProfile, changePassword, getStudentDashboard };
