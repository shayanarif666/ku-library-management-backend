const express = require('express');
const router = express.Router();
const { getBookReviews, addReview, updateReview, deleteReview } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/book/:bookId', getBookReviews);
router.post('/', protect, authorize('student'), addReview);
router.put('/:id', protect, authorize('student'), updateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
