const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const AuthController = require('../controllers/AuthController');

// Login page (GET)
router.get('/login', AuthController.loginPage);

// Login submission (POST)
router.post('/login', AuthController.login);

// Logout
router.post('/logout', isAuthenticated, AuthController.logout);

// Logout GET (for convenience)
router.get('/logout', isAuthenticated, AuthController.logout);

module.exports = router;
