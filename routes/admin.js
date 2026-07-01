const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middleware/auth');
const AdminController = require('../controllers/AdminController');

const articleUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'blog-posts');

fs.mkdirSync(articleUploadDir, { recursive: true });

const csvUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 3 * 1024 * 1024 },
});

const articleUpload = multer({
	storage: multer.diskStorage({
		destination: (req, file, cb) => cb(null, articleUploadDir),
		filename: (req, file, cb) => {
			const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
			cb(null, safeName);
		},
	}),
	fileFilter: (req, file, cb) => {
		if (!file.mimetype.startsWith('image/')) {
			return cb(new Error('Featured image must be an image file'));
		}
		cb(null, true);
	},
	limits: { fileSize: 5 * 1024 * 1024 },
});

const mediaUpload = multer({
	storage: multer.diskStorage({
		destination: (req, file, cb) => cb(null, articleUploadDir),
		filename: (req, file, cb) => {
			const base = path.basename(file.originalname, path.extname(file.originalname)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'media';
			const uniqueName = `${Date.now()}-${base}${path.extname(file.originalname).toLowerCase()}`;
			cb(null, uniqueName);
		},
	}),
	fileFilter: (req, file, cb) => {
		if (!file.mimetype.startsWith('image/')) {
			return cb(new Error('Only image uploads are allowed in the media library'));
		}
		cb(null, true);
	},
	limits: { fileSize: 10 * 1024 * 1024 },
});

// Apply authentication and authorization to all admin routes
router.use(isAuthenticated, isAdmin);
router.use(async (req, res, next) => {
	res.locals.layout = 'layouts/admin';
	try {
		res.locals.taxonomySummary = await AdminController.getTaxonomySummary();
		next();
	} catch (error) {
		next(error);
	}
});

function redirectWithSessionSave(req, res, location) {
	if (!req.session || typeof req.session.save !== 'function') {
		return res.redirect(location);
	}

	return req.session.save(() => {
		res.redirect(location);
	});
}

// Admin dashboard
router.get('/', AdminController.dashboard);

// Articles management
router.get('/articles', AdminController.articles);
router.get('/taxonomy', AdminController.taxonomy);
router.get('/taxonomy/categories', AdminController.taxonomyCategories);
router.get('/taxonomy/tags', AdminController.taxonomyTags);
router.post('/taxonomy/categories', AdminController.createCategory);
router.post('/taxonomy/categories/:name/rename', AdminController.renameCategory);
router.post('/taxonomy/categories/:name/delete', AdminController.deleteCategory);
router.post('/taxonomy/tags', AdminController.createTag);
router.post('/taxonomy/tags/:name/rename', AdminController.renameTag);
router.post('/taxonomy/tags/:name/delete', AdminController.deleteTag);
router.get('/articles/import', AdminController.importArticlesPage);
router.post('/articles/import', csvUpload.single('csvFile'), AdminController.importArticlesCsv);
router.get('/articles/new', AdminController.newArticle);
router.post('/articles', articleUpload.single('featuredImage'), AdminController.createArticle);
router.get('/articles/:id/edit', AdminController.editArticle);
router.post('/articles/:id', articleUpload.single('featuredImage'), AdminController.updateArticle);
router.post('/articles/:id/delete', AdminController.deleteArticle);
router.post('/articles/:id/publish', AdminController.publishArticle);

router.use((err, req, res, next) => {
	if (req.method === 'POST' && req.path === '/articles' && req.session) {
		req.session.articleErrors = [{ field: 'form', message: err.message || 'Unable to create the article right now.' }];
		req.session.articleFormData = {
			title: req.body?.title || '',
			slug: req.body?.slug || '',
			excerpt: req.body?.excerpt || '',
			content: req.body?.content || '',
			category: req.body?.category || '',
			tags: req.body?.tags || '',
			seoTitle: req.body?.seoTitle || '',
			metaDescription: req.body?.metaDescription || '',
			keywords: req.body?.keywords || '',
			published: req.body?.published === 'on' ? 'on' : '',
		};
		req.session.articleMessage = null;
		return redirectWithSessionSave(req, res, '/admin/articles/new#article-feedback-anchor');
	}

	if (req.method === 'POST' && req.path.match(/^\/articles\/[^/]+$/) && req.session) {
		const articleId = req.path.split('/')[2];
		req.session.articleErrors = [{ field: 'form', message: err.message || 'Unable to update the article right now.' }];
		req.session.articleFormData = {
			title: req.body?.title || '',
			slug: req.body?.slug || '',
			excerpt: req.body?.excerpt || '',
			content: req.body?.content || '',
			category: req.body?.category || '',
			tags: req.body?.tags || '',
			seoTitle: req.body?.seoTitle || '',
			metaDescription: req.body?.metaDescription || '',
			keywords: req.body?.keywords || '',
			published: req.body?.published === 'on' ? 'on' : '',
		};
		req.session.articleMessage = null;
		return redirectWithSessionSave(req, res, `/admin/articles/${articleId}/edit#article-feedback-anchor`);
	}

	next(err);
});

// Media library
router.get('/media', AdminController.media);
router.post('/media/upload', mediaUpload.single('file'), AdminController.uploadMedia);
router.post('/media/:id/update', AdminController.updateMedia);
router.post('/media/:id/delete', AdminController.deleteMedia);

// User management (superadmin only)
router.get('/users', isSuperAdmin, AdminController.users);
router.get('/users/new', isSuperAdmin, AdminController.newUser);
router.post('/users', isSuperAdmin, AdminController.createUser);
router.post('/users/:id/disable', isSuperAdmin, AdminController.disableUser);

module.exports = router;
