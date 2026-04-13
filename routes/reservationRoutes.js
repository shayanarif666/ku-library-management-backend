const express = require('express');
const router = express.Router();
const { getReservations, reserveBook, cancelReservation, getBookQueue } = require('../controllers/reservationController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/', getReservations);
router.post('/', authorize('student'), reserveBook);
router.get('/book/:bookId', authorize('admin', 'superadmin'), getBookQueue);
router.put('/:id/cancel', cancelReservation);

module.exports = router;
