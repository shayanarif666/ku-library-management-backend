const express = require('express');
const router = express.Router();
const {
  getDashboard, getUsers, toggleUserStatus, updateUserRole, getActivityLogs,
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect, authorize('admin', 'superadmin'));

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.put('/users/:id/role', authorize('superadmin'), updateUserRole);
router.get('/logs', getActivityLogs);

module.exports = router;
