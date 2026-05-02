const express = require('express');
const router = express.Router();
const { getBooks, getBook, getCategories, addBook, updateBook, deleteBook } = require('../controllers/bookController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { uploadBookCover } = require('../config/cloudinary');

// Wrap multer so its errors are forwarded as proper HTTP 400 responses
// instead of crashing with an unhandled 500 (e.g. missing Cloudinary env vars)
const handleUpload = (req, res, next) => {
  uploadBookCover.single('coverImage')(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'Cover image must be under 5 MB'
      : `Image upload failed: ${err.message}`;
    res.status(400);
    next(new Error(msg));
  });
};

router.get('/categories', getCategories);
router.get('/', getBooks);
router.get('/:id', getBook);

router.post('/', protect, authorize('admin', 'superadmin'), handleUpload, addBook);
router.put('/:id', protect, authorize('admin', 'superadmin'), handleUpload, updateBook);
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteBook);

module.exports = router;
