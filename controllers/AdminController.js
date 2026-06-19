const { BlogPost, User } = require('../models');
const bcryptjs = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class AdminController {
  // Dashboard
  static async dashboard(req, res, next) {
    try {
      const totalArticles = await BlogPost.count();
      const publishedArticles = await BlogPost.count({ where: { published: true } });
      const draftArticles = totalArticles - publishedArticles;
      const totalUsers = await User.count();

      res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        totalArticles,
        publishedArticles,
        draftArticles,
        totalUsers,
      });
    } catch (error) {
      next(error);
    }
  }

  // List articles
  static async articles(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      const { count, rows: articles } = await BlogPost.findAndCountAll({
        include: [{ model: User, as: 'author', attributes: ['name'] }],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      const totalPages = Math.ceil(count / limit);

      res.render('admin/articles', {
        title: 'Manage Articles',
        articles,
        currentPage: page,
        totalPages,
      });
    } catch (error) {
      next(error);
    }
  }

  // New article form
  static async newArticle(req, res, next) {
    try {
      res.render('admin/article-form', {
        title: 'Create New Article',
        article: null,
        isNew: true,
      });
    } catch (error) {
      next(error);
    }
  }

  // Create article
  static async createArticle(req, res, next) {
    try {
      const { title, slug, excerpt, content, category, tags, seoTitle, metaDescription, keywords, published } = req.body;

      // Validate slug uniqueness
      const existing = await BlogPost.findOne({ where: { slug } });
      if (existing) {
        return res.status(400).render('admin/article-form', {
          title: 'Create New Article',
          article: null,
          isNew: true,
          errors: [{ field: 'slug', message: 'Slug already exists' }],
        });
      }

      const article = await BlogPost.create({
        title,
        slug,
        excerpt,
        content,
        category,
        tags: tags ? tags.split(',').map((t) => t.trim()) : [],
        seoTitle: seoTitle || title,
        metaDescription: metaDescription || excerpt,
        keywords,
        published: published === 'on',
        publishDate: published === 'on' ? new Date() : null,
        authorId: req.session.user.id,
      });

      req.session.success = 'Article created successfully!';
      res.redirect(`/admin/articles/${article.id}/edit`);
    } catch (error) {
      next(error);
    }
  }

  // Edit article form
  static async editArticle(req, res, next) {
    try {
      const { id } = req.params;

      const article = await BlogPost.findByPk(id);
      if (!article) {
        return res.status(404).render('pages/404', { title: 'Article Not Found' });
      }

      res.render('admin/article-form', {
        title: 'Edit Article',
        article,
        isNew: false,
      });
    } catch (error) {
      next(error);
    }
  }

  // Update article
  static async updateArticle(req, res, next) {
    try {
      const { id } = req.params;
      const { title, slug, excerpt, content, category, tags, seoTitle, metaDescription, keywords, published } = req.body;

      const article = await BlogPost.findByPk(id);
      if (!article) {
        return res.status(404).render('pages/404', { title: 'Article Not Found' });
      }

      // Check if slug is being changed and if new slug already exists
      if (slug !== article.slug) {
        const existing = await BlogPost.findOne({ where: { slug } });
        if (existing) {
          return res.status(400).render('admin/article-form', {
            title: 'Edit Article',
            article,
            isNew: false,
            errors: [{ field: 'slug', message: 'Slug already exists' }],
          });
        }
      }

      await article.update({
        title,
        slug,
        excerpt,
        content,
        category,
        tags: tags ? tags.split(',').map((t) => t.trim()) : [],
        seoTitle: seoTitle || title,
        metaDescription: metaDescription || excerpt,
        keywords,
        published: published === 'on',
        publishDate: published === 'on' && !article.publishDate ? new Date() : article.publishDate,
      });

      req.session.success = 'Article updated successfully!';
      res.redirect('/admin/articles');
    } catch (error) {
      next(error);
    }
  }

  // Delete article
  static async deleteArticle(req, res, next) {
    try {
      const { id } = req.params;

      const article = await BlogPost.findByPk(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      await article.destroy();

      req.session.success = 'Article deleted successfully!';
      res.redirect('/admin/articles');
    } catch (error) {
      next(error);
    }
  }

  // Publish article
  static async publishArticle(req, res, next) {
    try {
      const { id } = req.params;

      const article = await BlogPost.findByPk(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      await article.update({
        published: true,
        publishDate: article.publishDate || new Date(),
      });

      res.json({ success: true, message: 'Article published!' });
    } catch (error) {
      next(error);
    }
  }

  // Media library
  static async media(req, res, next) {
    try {
      res.render('admin/media', {
        title: 'Media Library',
      });
    } catch (error) {
      next(error);
    }
  }

  // Upload media
  static async uploadMedia(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      res.json({
        success: true,
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete media
  static async deleteMedia(req, res, next) {
    try {
      // TODO: Implement file deletion
      res.json({ success: true, message: 'Media deleted!' });
    } catch (error) {
      next(error);
    }
  }

  // User management
  static async users(req, res, next) {
    try {
      const users = await User.findAll({
        attributes: { exclude: ['password'] },
        order: [['createdAt', 'DESC']],
      });

      res.render('admin/users', {
        title: 'Manage Users',
        users,
      });
    } catch (error) {
      next(error);
    }
  }

  // New user form
  static async newUser(req, res, next) {
    try {
      res.render('admin/user-form', {
        title: 'Create New User',
        user: null,
        isNew: true,
      });
    } catch (error) {
      next(error);
    }
  }

  // Create user
  static async createUser(req, res, next) {
    try {
      const { name, email, password, role } = req.body;

      // Check if email exists
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(400).render('admin/user-form', {
          title: 'Create New User',
          user: null,
          isNew: true,
          errors: [{ field: 'email', message: 'Email already in use' }],
        });
      }

      // Hash password
      const hashedPassword = await bcryptjs.hash(password, 10);

      await User.create({
        name,
        email,
        password: hashedPassword,
        role: role || 'admin',
      });

      req.session.success = 'User created successfully!';
      res.redirect('/admin/users');
    } catch (error) {
      next(error);
    }
  }

  // Disable user
  static async disableUser(req, res, next) {
    try {
      const { id } = req.params;

      // Prevent disabling yourself
      if (id === req.session.user.id) {
        return res.status(400).json({ error: 'Cannot disable your own account' });
      }

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await user.update({ active: false });

      res.json({ success: true, message: 'User disabled!' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminController;
