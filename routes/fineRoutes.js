const express = require('express');
const router = express.Router();
const { getFines, getFine, markFinePaid, getFineSummary } = require('../controllers/fineController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/summary', getFineSummary);
router.get('/', getFines);
router.get('/:id', getFine);
router.put('/:id/pay', authorize('admin', 'superadmin'), markFinePaid);

module.exports = router;
