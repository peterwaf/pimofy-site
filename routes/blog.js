const express = require('express');
const router = express.Router();
const BlogController = require('../controllers/BlogController');

// Blog listing page
router.get('/', BlogController.index);

// Blog by category
router.get('/category/:category', BlogController.byCategory);

// Blog by tag
router.get('/tag/:tag', BlogController.byTag);

// Search
router.get('/search', BlogController.search);

// Single blog post (must be last to avoid conflicts)
router.get('/:slug', BlogController.show);

module.exports = router;
