const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"${process.env.FROM_NAME || 'University Library'}" <${process.env.FROM_EMAIL}>`;

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (error) {
    console.error('Email send error:', error.message);
  }
};

const emailTemplates = {
  issueApproved: (userName, bookTitle, dueDate) => ({
    subject: 'Book Issue Approved',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px">
        <h2 style="color:#4f46e5">Book Issue Approved</h2>
        <p>Dear <strong>${userName}</strong>,</p>
        <p>Your book issue request has been approved.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#f5f3ff;font-weight:bold">Book</td><td style="padding:8px">${bookTitle}</td></tr>
          <tr><td style="padding:8px;background:#f5f3ff;font-weight:bold">Due Date</td><td style="padding:8px">${new Date(dueDate).toDateString()}</td></tr>
        </table>
        <p>Please return the book by the due date to avoid fines.</p>
        <p style="color:#6b7280;font-size:13px">— University Library System</p>
      </div>`,
  }),

  dueDateReminder: (userName, bookTitle, dueDate, daysLeft) => ({
    subject: `Reminder: Book Due in ${daysLeft} Day(s)`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #fbbf24;border-radius:8px">
        <h2 style="color:#d97706">Due Date Reminder</h2>
        <p>Dear <strong>${userName}</strong>,</p>
        <p>This is a reminder that your book is due in <strong>${daysLeft} day(s)</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#fffbeb;font-weight:bold">Book</td><td style="padding:8px">${bookTitle}</td></tr>
          <tr><td style="padding:8px;background:#fffbeb;font-weight:bold">Due Date</td><td style="padding:8px">${new Date(dueDate).toDateString()}</td></tr>
        </table>
        <p>Please return or renew the book to avoid late fines.</p>
        <p style="color:#6b7280;font-size:13px">— University Library System</p>
      </div>`,
  }),

  overdueAlert: (userName, bookTitle, daysLate, fineAmount) => ({
    subject: 'Overdue Book Alert',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ef4444;border-radius:8px">
        <h2 style="color:#dc2626">Overdue Book Alert</h2>
        <p>Dear <strong>${userName}</strong>,</p>
        <p>Your borrowed book is <strong>${daysLate} day(s) overdue</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#fef2f2;font-weight:bold">Book</td><td style="padding:8px">${bookTitle}</td></tr>
          <tr><td style="padding:8px;background:#fef2f2;font-weight:bold">Days Overdue</td><td style="padding:8px">${daysLate}</td></tr>
          <tr><td style="padding:8px;background:#fef2f2;font-weight:bold">Current Fine</td><td style="padding:8px">$${fineAmount.toFixed(2)}</td></tr>
        </table>
        <p>Please return the book immediately to stop further fines.</p>
        <p style="color:#6b7280;font-size:13px">— University Library System</p>
      </div>`,
  }),

  reservationAvailable: (userName, bookTitle, expiresAt) => ({
    subject: 'Reserved Book Now Available',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #10b981;border-radius:8px">
        <h2 style="color:#059669">Book Now Available</h2>
        <p>Dear <strong>${userName}</strong>,</p>
        <p>The book you reserved is now available for pickup.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#f0fdf4;font-weight:bold">Book</td><td style="padding:8px">${bookTitle}</td></tr>
          <tr><td style="padding:8px;background:#f0fdf4;font-weight:bold">Hold Expires</td><td style="padding:8px">${new Date(expiresAt).toDateString()}</td></tr>
        </table>
        <p>Please visit the library before the hold expires.</p>
        <p style="color:#6b7280;font-size:13px">— University Library System</p>
      </div>`,
  }),
};

module.exports = { sendEmail, emailTemplates };
