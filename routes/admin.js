const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middleware/auth');
const AdminController = require('../controllers/AdminController');

// Apply authentication and authorization to all admin routes
router.use(isAuthenticated, isAdmin);

// Admin dashboard
router.get('/', AdminController.dashboard);

// Articles management
router.get('/articles', AdminController.articles);
router.get('/articles/new', AdminController.newArticle);
router.post('/articles', AdminController.createArticle);
router.get('/articles/:id/edit', AdminController.editArticle);
router.post('/articles/:id', AdminController.updateArticle);
router.post('/articles/:id/delete', AdminController.deleteArticle);
router.post('/articles/:id/publish', AdminController.publishArticle);

// Media library
router.get('/media', AdminController.media);
router.post('/media/upload', AdminController.uploadMedia);
router.post('/media/:id/delete', AdminController.deleteMedia);

// User management (superadmin only)
router.get('/users', isSuperAdmin, AdminController.users);
router.get('/users/new', isSuperAdmin, AdminController.newUser);
router.post('/users', isSuperAdmin, AdminController.createUser);
router.post('/users/:id/disable', isSuperAdmin, AdminController.disableUser);

module.exports = router;
