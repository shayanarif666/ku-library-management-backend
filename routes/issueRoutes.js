const express = require('express');
const router = express.Router();
const {
  getIssues, getOverdueIssues, requestIssue,
  approveIssue, rejectIssue, returnBook, getIssue,
} = require('../controllers/issueController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/overdue', authorize('admin', 'superadmin'), getOverdueIssues);
router.get('/', getIssues);
router.get('/:id', getIssue);
router.post('/', authorize('student'), requestIssue);
router.put('/:id/approve', authorize('admin', 'superadmin'), approveIssue);
router.put('/:id/reject', authorize('admin', 'superadmin'), rejectIssue);
router.put('/:id/return', authorize('admin', 'superadmin'), returnBook);

module.exports = router;
