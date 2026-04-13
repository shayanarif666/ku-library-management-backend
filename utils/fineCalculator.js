const Fine = require('../models/Fine');
const Issue = require('../models/Issue');

const FINE_PER_DAY = parseFloat(process.env.FINE_PER_DAY) || 5;

/**
 * Calculate days late from dueDate to returnDate (or today if not yet returned)
 */
const calcDaysLate = (dueDate, returnDate = new Date()) => {
  const due = new Date(dueDate);
  const returned = new Date(returnDate);
  due.setHours(0, 0, 0, 0);
  returned.setHours(0, 0, 0, 0);
  const diff = Math.floor((returned - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

/**
 * Generate a fine for a returned issue if overdue
 */
const generateFine = async (issue) => {
  if (!issue.dueDate || !issue.returnDate) return null;

  const daysLate = calcDaysLate(issue.dueDate, issue.returnDate);
  if (daysLate <= 0) return null;

  const amount = daysLate * FINE_PER_DAY;

  const fine = await Fine.create({
    issue: issue._id,
    user: issue.user,
    book: issue.book,
    daysLate,
    perDayRate: FINE_PER_DAY,
    amount,
    status: 'unpaid',
  });

  await Issue.findByIdAndUpdate(issue._id, { fineGenerated: true });

  return fine;
};

/**
 * Get current outstanding fine amount for a user
 */
const getUserOutstandingFines = async (userId) => {
  const result = await Fine.aggregate([
    { $match: { user: userId, status: 'unpaid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result.length > 0 ? result[0].total : 0;
};

module.exports = { calcDaysLate, generateFine, getUserOutstandingFines, FINE_PER_DAY };
