const express = require('express');
const router = express.Router();
const PageController = require('../controllers/PageController');

// Home page
router.get('/', PageController.home);

// Public pages
router.get('/solutions', PageController.solutions);
router.get('/data-operations', PageController.dataOperations);
router.get('/capacity-audit', PageController.capacityAudit);
router.get('/industries', PageController.industries);
router.get('/about', PageController.about);
router.get('/resources', PageController.resources); // Redirect to blog listing

// Legal pages
router.get('/privacy', PageController.privacy);
router.get('/terms', PageController.terms);

// Dynamic sitemap
router.get('/sitemap.xml', PageController.sitemap);

// Robots.txt
router.get('/robots.txt', PageController.robots);

module.exports = router;
