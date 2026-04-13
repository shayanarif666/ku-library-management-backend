const express = require('express');
const router = express.Router();
const { getBooks, getBook, getCategories, addBook, updateBook, deleteBook } = require('../controllers/bookController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { uploadBookCover } = require('../config/cloudinary');

router.get('/categories', getCategories);
router.get('/', getBooks);
router.get('/:id', getBook);

router.post('/', protect, authorize('admin', 'superadmin'), uploadBookCover.single('coverImage'), addBook);
router.put('/:id', protect, authorize('admin', 'superadmin'), uploadBookCover.single('coverImage'), updateBook);
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteBook);

module.exports = router;
