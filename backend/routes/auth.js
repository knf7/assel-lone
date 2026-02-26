const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport');
const { authenticateToken, JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// Traditional Auth
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.get('/me', authenticateToken, authController.me);
router.post('/refresh', authenticateToken, authController.refresh);
router.post('/logout', authenticateToken, authController.logout);
router.post('/end-all-sessions', authenticateToken, authController.endAllSessions);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/step-up', authenticateToken, authController.issueStepUpToken);

module.exports = router;
