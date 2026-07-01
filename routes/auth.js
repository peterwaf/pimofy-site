const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { isAuthenticated } = require('../middleware/auth');
const AuthController = require('../controllers/AuthController');

const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: 'Too many login attempts. Please try again in a few minutes.',
});

function handleLoginValidation(req, res, next) {
	const errors = validationResult(req);
	if (errors.isEmpty()) {
		return next();
	}

	const formattedErrors = [];

	for (const error of errors.array()) {
		if (error.path === 'password') {
			formattedErrors.push({
				field: 'password',
				message: 'Password must be 8 to 128 characters long. Check that your password matches the expected admin credentials.',
			});
			continue;
		}

		if (error.path === 'email') {
			formattedErrors.push({
				field: 'email',
				message: 'Please enter a valid email address.',
			});
			continue;
		}

		formattedErrors.push({
			field: error.path || 'form',
			message: error.msg || 'Please review the login details and try again.',
		});
	}

	req.session.errors = formattedErrors.length
		? formattedErrors
		: [{ field: 'form', message: 'Please review the login details and try again.' }];
	return res.redirect('/auth/login');
}

// Login page (GET)
router.get('/login', AuthController.loginPage);

// Login submission (POST)
router.post(
	'/login',
	loginLimiter,
	[
		body('email').trim().isEmail().withMessage('Invalid email').normalizeEmail(),
		body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Invalid password'),
	],
	handleLoginValidation,
	AuthController.login
);

// Logout
router.post('/logout', isAuthenticated, AuthController.logout);

module.exports = router;
