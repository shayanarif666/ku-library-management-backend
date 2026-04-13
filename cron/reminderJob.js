const cron = require('node-cron');
const Issue = require('../models/Issue');
const { sendEmail, emailTemplates } = require('../utils/emailService');
const { FINE_PER_DAY, calcDaysLate } = require('../utils/fineCalculator');

// Run every day at 9 AM — send due date reminders and overdue alerts
cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] Running email reminder job...');
  try {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // Due in 3 days reminder
    const dueSoon = await Issue.find({
      status: 'issued',
      dueDate: {
        $gte: new Date(in3Days.toDateString()),
        $lte: new Date(new Date(in3Days.toDateString()).getTime() + 24 * 60 * 60 * 1000 - 1),
      },
    }).populate('book', 'title').populate('user', 'name email');

    for (const issue of dueSoon) {
      const { subject, html } = emailTemplates.dueDateReminder(
        issue.user.name, issue.book.title, issue.dueDate, 3
      );
      sendEmail(issue.user.email, subject, html);
    }

    // Due tomorrow reminder
    const dueTomorrow = await Issue.find({
      status: 'issued',
      dueDate: {
        $gte: new Date(in1Day.toDateString()),
        $lte: new Date(new Date(in1Day.toDateString()).getTime() + 24 * 60 * 60 * 1000 - 1),
      },
    }).populate('book', 'title').populate('user', 'name email');

    for (const issue of dueTomorrow) {
      const { subject, html } = emailTemplates.dueDateReminder(
        issue.user.name, issue.book.title, issue.dueDate, 1
      );
      sendEmail(issue.user.email, subject, html);
    }

    // Overdue alerts
    const overdue = await Issue.find({
      status: 'issued',
      dueDate: { $lt: new Date(new Date().toDateString()) },
    }).populate('book', 'title').populate('user', 'name email');

    for (const issue of overdue) {
      const daysLate = calcDaysLate(issue.dueDate);
      const fineAmount = daysLate * FINE_PER_DAY;
      const { subject, html } = emailTemplates.overdueAlert(
        issue.user.name, issue.book.title, daysLate, fineAmount
      );
      sendEmail(issue.user.email, subject, html);
    }

    console.log(`[CRON] Reminder job complete. Due-soon: ${dueSoon.length + dueTomorrow.length}, Overdue: ${overdue.length}`);
  } catch (err) {
    console.error('[CRON] Reminder job error:', err.message);
  }
});
