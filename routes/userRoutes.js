const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, changePassword, getStudentDashboard } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { uploadAvatar } = require('../config/cloudinary');

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', uploadAvatar.single('avatar'), updateProfile);
router.put('/change-password', changePassword);
router.get('/dashboard', getStudentDashboard);

module.exports = router;
