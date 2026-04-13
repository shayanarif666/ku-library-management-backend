const ActivityLog = require('../models/ActivityLog');

const log = async ({ userId, action, details = '', entityType = 'System', entityId = null, ip = '' }) => {
  try {
    await ActivityLog.create({
      user: userId || null,
      action,
      details,
      entityType,
      entityId: entityId || null,
      ip,
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

module.exports = { log };
