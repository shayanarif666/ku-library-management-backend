const cron = require('node-cron');
const Issue = require('../models/Issue');
const Fine = require('../models/Fine');
const { FINE_PER_DAY } = require('../utils/fineCalculator');

// Run every day at midnight — generate fines for overdue unreturned books
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Running overdue fine generation job...');
  try {
    const now = new Date();

    // Find all issued (not returned) books that are overdue and no fine yet
    const overdueIssues = await Issue.find({
      status: 'issued',
      dueDate: { $lt: now },
      fineGenerated: false,
    }).populate('user book');

    let generated = 0;

    for (const issue of overdueIssues) {
      const due = new Date(issue.dueDate);
      due.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const daysLate = Math.floor((today - due) / (1000 * 60 * 60 * 24));
      if (daysLate <= 0) continue;

      // Check if fine already exists for this issue
      const existingFine = await Fine.findOne({ issue: issue._id });
      if (existingFine) {
        // Update existing fine amount
        existingFine.daysLate = daysLate;
        existingFine.amount = daysLate * FINE_PER_DAY;
        await existingFine.save();
      } else {
        await Fine.create({
          issue: issue._id,
          user: issue.user._id,
          book: issue.book._id,
          daysLate,
          perDayRate: FINE_PER_DAY,
          amount: daysLate * FINE_PER_DAY,
          status: 'unpaid',
        });
        generated++;
      }
    }

    console.log(`[CRON] Fine job complete. Generated: ${generated}, Updated: ${overdueIssues.length - generated}`);
  } catch (err) {
    console.error('[CRON] Fine job error:', err.message);
  }
});
