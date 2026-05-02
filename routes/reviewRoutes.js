const express = require('express');
const router = express.Router();
const { getBookReviews, addReview, updateReview, deleteReview, getRecentReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/recent', getRecentReviews);
router.get('/book/:bookId', getBookReviews);
router.post('/', protect, authorize('student'), addReview);
router.put('/:id', protect, authorize('student'), updateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
