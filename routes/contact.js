const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const ContactController = require('../controllers/ContactController');

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many contact requests. Please try again shortly.',
});

function normalizeWebsiteUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

// Contact page (GET)
router.get('/', ContactController.page);

// Submit contact form (POST)
router.post(
  '/',
  contactLimiter,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Full name is required')
      .bail()
      .isLength({ min: 2, max: 80 })
      .withMessage('Full name must be between 2 and 80 characters')
      .bail()
      .matches(/^[\p{L}\p{M} .,'-]+$/u)
      .withMessage('Full name contains invalid characters')
      .bail()
      .custom((value) => !/[\r\n]/.test(value))
      .withMessage('Full name is invalid'),
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Work email is required')
      .bail()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .bail()
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false,
        icloud_remove_subaddress: false,
      })
      .custom((value) => !/[\r\n]/.test(value))
      .withMessage('Email is invalid'),
    body('company')
      .trim()
      .notEmpty()
      .withMessage('Company is required')
      .bail()
      .isLength({ min: 2, max: 120 })
      .withMessage('Company must be between 2 and 120 characters')
      .bail()
      .custom((value) => !/[\r\n]/.test(value))
      .withMessage('Company is invalid'),
    body('type')
      .optional({ checkFalsy: true })
      .isIn(['SaaS', 'Ecommerce', 'Other'])
      .withMessage('Company type is invalid'),
    body('website')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 2048 })
      .withMessage('Website URL is too long')
      .bail()
      .customSanitizer((value) => normalizeWebsiteUrl(value))
      .isURL({
        protocols: ['http', 'https'],
        require_protocol: true,
        require_tld: true,
      })
      .withMessage('Website must be a valid domain or http(s) URL'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required')
      .bail()
      .isLength({ min: 20, max: 4000 })
      .withMessage('Message must be between 20 and 4000 characters'),
  ],
  handleValidationErrors,
  ContactController.submit
);

module.exports = router;
