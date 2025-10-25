const express = require('express');
const { signUp, completeProfile, login, logout, getCurrentUser, forgotPassword, resetPassword, googleAuthCallback } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes
router.post('/signup', signUp);
router.post('/complete-profile', completeProfile);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google/callback', googleAuthCallback);

// Protected route - get current user
router.get('/me', authenticateToken, getCurrentUser);

module.exports = router;