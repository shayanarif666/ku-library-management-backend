const asyncHandler = require('express-async-handler');
const Book = require('../models/Book');
const { cloudinary } = require('../config/cloudinary');
const { log } = require('../utils/activityLogger');

// @desc    Get all books (paginated, searchable, filterable)
// @route   GET /api/books
// @access  Public
const getBooks = asyncHandler(async (req, res) => {
  const {
    search = '',
    category = '',
    available = '',
    sort = '-createdAt',
    page = 1,
    limit = 12,
  } = req.query;

  const query = { isDeleted: false };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { author: { $regex: search, $options: 'i' } },
      { ISBN: { $regex: search, $options: 'i' } },
    ];
  }

  if (category) query.category = { $regex: category, $options: 'i' };
  if (available === 'true') query.availableCopies = { $gt: 0 };
  if (available === 'false') query.availableCopies = 0;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [books, total] = await Promise.all([
    Book.find(query).sort(sort).skip(skip).limit(limitNum),
    Book.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: books,
    pagination: {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
    },
  });
});

// @desc    Get single book
// @route   GET /api/books/:id
// @access  Public
const getBook = asyncHandler(async (req, res) => {
  const book = await Book.findOne({ _id: req.params.id, isDeleted: false });
  if (!book) {
    res.status(404);
    throw new Error('Book not found');
  }
  res.json({ success: true, data: book });
});

// @desc    Get all categories
// @route   GET /api/books/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Book.distinct('category', { isDeleted: false });
  res.json({ success: true, data: categories.sort() });
});

// @desc    Add book
// @route   POST /api/books
// @access  Admin
const addBook = asyncHandler(async (req, res) => {
  const { title, author, ISBN, category, description, publisher, edition, year, language, pages, totalCopies } = req.body;

  if (!title || !author || !ISBN || !category) {
    res.status(400);
    throw new Error('Title, author, ISBN and category are required');
  }

  const bookData = {
    title, author, ISBN, category, description, publisher,
    edition, year, language, pages,
    totalCopies: parseInt(totalCopies) || 1,
    availableCopies: parseInt(totalCopies) || 1,
  };

  if (req.file) {
    bookData.coverImage = {
      public_id: req.file.filename,
      url: req.file.path,
    };
  }

  const book = await Book.create(bookData);

  await log({
    userId: req.user._id,
    action: 'BOOK_ADDED',
    details: `Added book: ${title} (ISBN: ${ISBN})`,
    entityType: 'Book',
    entityId: book._id,
    ip: req.ip,
  });

  res.status(201).json({ success: true, data: book });
});

// @desc    Update book
// @route   PUT /api/books/:id
// @access  Admin
const updateBook = asyncHandler(async (req, res) => {
  const book = await Book.findOne({ _id: req.params.id, isDeleted: false });
  if (!book) {
    res.status(404);
    throw new Error('Book not found');
  }

  const { totalCopies, ...rest } = req.body;

  if (totalCopies !== undefined) {
    const newTotal = parseInt(totalCopies);
    const diff = newTotal - book.totalCopies;
    rest.totalCopies = newTotal;
    rest.availableCopies = Math.max(0, book.availableCopies + diff);
  }

  if (req.file) {
    if (book.coverImage?.public_id) {
      await cloudinary.uploader.destroy(book.coverImage.public_id);
    }
    rest.coverImage = { public_id: req.file.filename, url: req.file.path };
  }

  const updated = await Book.findByIdAndUpdate(req.params.id, rest, { new: true, runValidators: true });

  await log({
    userId: req.user._id,
    action: 'BOOK_UPDATED',
    details: `Updated book: ${book.title}`,
    entityType: 'Book',
    entityId: book._id,
    ip: req.ip,
  });

  res.json({ success: true, data: updated });
});

// @desc    Delete book (soft delete)
// @route   DELETE /api/books/:id
// @access  Admin
const deleteBook = asyncHandler(async (req, res) => {
  const book = await Book.findOne({ _id: req.params.id, isDeleted: false });
  if (!book) {
    res.status(404);
    throw new Error('Book not found');
  }

  if (book.availableCopies < book.totalCopies) {
    res.status(400);
    throw new Error('Cannot delete a book with active issues');
  }

  book.isDeleted = true;
  await book.save();

  await log({
    userId: req.user._id,
    action: 'BOOK_DELETED',
    details: `Deleted book: ${book.title} (ISBN: ${book.ISBN})`,
    entityType: 'Book',
    entityId: book._id,
    ip: req.ip,
  });

  res.json({ success: true, message: 'Book deleted successfully' });
});

module.exports = { getBooks, getBook, getCategories, addBook, updateBook, deleteBook };
