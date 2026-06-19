const { BlogPost, User } = require('../models');
const bcryptjs = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    field += ch;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseBool(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseTags(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return [];
  }

  const separator = raw.includes('|') ? '|' : ',';
  return raw
    .split(separator)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function toDateOrNull(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseArticleTags(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildArticleFormData(req, article = null) {
  const body = req.body || {};
  const current = article ? article.get({ plain: true }) : {};

  return {
    ...current,
    title: body.title ?? current.title ?? '',
    slug: body.slug ?? current.slug ?? '',
    excerpt: body.excerpt ?? current.excerpt ?? '',
    content: body.content ?? current.content ?? '',
    featuredImage: current.featuredImage || '',
    category: body.category ?? current.category ?? '',
    tags: body.tags ? parseArticleTags(body.tags) : current.tags || [],
    seoTitle: body.seoTitle ?? current.seoTitle ?? '',
    metaDescription: body.metaDescription ?? current.metaDescription ?? '',
    keywords: body.keywords ?? current.keywords ?? '',
    published: body.published === 'on' ? true : Boolean(current.published),
  };
}

function resolveFeaturedImage(req, article = null) {
  if (req.file) {
    return `/uploads/blog-posts/${req.file.filename}`;
  }

  if (article && article.featuredImage) {
    return article.featuredImage;
  }

  return null;
}

function isImageFile(filename) {
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(filename);
}

async function listMediaFiles() {
  const mediaRoots = [
    {
      dir: path.join(__dirname, '..', 'public', 'uploads', 'blog-posts'),
      urlPrefix: '/uploads/blog-posts',
    },
  ];

  const files = [];

  for (const root of mediaRoots) {
    if (!fs.existsSync(root.dir)) {
      continue;
    }

    const entries = await fs.promises.readdir(root.dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !isImageFile(entry.name)) {
        continue;
      }

      const fullPath = path.join(root.dir, entry.name);
      const stat = await fs.promises.stat(fullPath);

      files.push({
        filename: entry.name,
        url: `${root.urlPrefix}/${entry.name}`,
        size: stat.size,
        updatedAt: stat.mtime,
      });
    }
  }

  return files.sort((left, right) => right.updatedAt - left.updatedAt);
}

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
        title: 'Articles',
        articles,
        currentPage: page,
        totalPages,
      });
    } catch (error) {
      next(error);
    }
  }

  // CSV import form
  static async importArticlesPage(req, res, next) {
    try {
      res.render('admin/articles-import', {
        title: 'Import Articles from CSV',
        result: null,
      });
    } catch (error) {
      next(error);
    }
  }

  // CSV import handler
  static async importArticlesCsv(req, res, next) {
    try {
      const mode = req.body.mode || 'upsert';
      const csvText = req.file?.buffer?.toString('utf8') || String(req.body.csvText || '');
      const cleanedCsvText = csvText.replace(/^\uFEFF/, '').trim();

      if (!cleanedCsvText) {
        return res.status(400).render('admin/articles-import', {
          title: 'Import Articles from CSV',
          result: {
            ok: false,
            message: 'Please upload a CSV file or paste CSV content.',
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [],
          },
        });
      }

      const rows = parseCsv(cleanedCsvText);
      if (!rows.length) {
        return res.status(400).render('admin/articles-import', {
          title: 'Import Articles from CSV',
          result: {
            ok: false,
            message: 'CSV is empty.',
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [],
          },
        });
      }

      const headers = rows[0].map((h) => String(h || '').trim());
      const requiredHeaders = ['title', 'slug', 'excerpt', 'content'];
      const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

      if (missingHeaders.length) {
        return res.status(400).render('admin/articles-import', {
          title: 'Import Articles from CSV',
          result: {
            ok: false,
            message: `Missing required CSV headers: ${missingHeaders.join(', ')}`,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [],
          },
        });
      }

      const rowData = rows.slice(1);
      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors = [];

      for (let index = 0; index < rowData.length; index += 1) {
        const lineNumber = index + 2;
        const row = rowData[index];
        const rowObject = {};

        headers.forEach((header, i) => {
          rowObject[header] = row[i] !== undefined ? String(row[i]).trim() : '';
        });

        const title = rowObject.title;
        const slug = rowObject.slug || slugify(title);
        const excerpt = rowObject.excerpt;
        const content = rowObject.content;

        if (!title && !slug && !excerpt && !content) {
          continue;
        }

        if (!title || !slug || !excerpt || !content) {
          skipped += 1;
          errors.push(`Line ${lineNumber}: title, slug, excerpt, and content are required.`);
          continue;
        }

        const publishDateFromCsv = toDateOrNull(rowObject.publishDate);
        const isPublished = parseBool(rowObject.published);
        const articlePayload = {
          title,
          slug,
          excerpt,
          content,
          category: rowObject.category || null,
          tags: parseTags(rowObject.tags),
          seoTitle: rowObject.seoTitle || title,
          metaDescription: rowObject.metaDescription || excerpt,
          keywords: rowObject.keywords || null,
          published: isPublished,
          publishDate: isPublished ? publishDateFromCsv || new Date() : null,
        };

        const existing = await BlogPost.findOne({ where: { slug } });

        if (existing) {
          if (mode === 'create-only') {
            skipped += 1;
            continue;
          }

          await existing.update({
            ...articlePayload,
            publishDate:
              isPublished && !existing.publishDate
                ? articlePayload.publishDate
                : existing.publishDate,
          });
          updated += 1;
          continue;
        }

        if (mode === 'update-only') {
          skipped += 1;
          continue;
        }

        await BlogPost.create({
          ...articlePayload,
          authorId: req.session.user.id,
        });
        created += 1;
      }

      return res.render('admin/articles-import', {
        title: 'Import Articles from CSV',
        result: {
          ok: true,
          message: 'CSV import completed.',
          created,
          updated,
          skipped,
          errors,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // New article form
  static async newArticle(req, res, next) {
    try {
      const errors = req.session.articleErrors || [];
      const formData = req.session.articleFormData || {};
      const articleMessage = req.session.articleMessage || null;

      req.session.articleErrors = [];
      req.session.articleFormData = {};
      req.session.articleMessage = null;

      res.render('admin/article-form', {
        title: 'Create New Article',
        article: null,
        isNew: true,
        errors,
        formData,
        articleMessage,
      });
    } catch (error) {
      next(error);
    }
  }

  // Create article
  static async createArticle(req, res, next) {
    try {
      const { title, slug, excerpt, content } = req.body;
      const formData = {
        title: req.body.title || '',
        slug: req.body.slug || '',
        excerpt: req.body.excerpt || '',
        content: req.body.content || '',
        category: req.body.category || '',
        tags: req.body.tags || '',
        seoTitle: req.body.seoTitle || '',
        metaDescription: req.body.metaDescription || '',
        keywords: req.body.keywords || '',
        published: req.body.published === 'on' ? 'on' : '',
      };

      // Validate slug uniqueness
      const existing = await BlogPost.findOne({ where: { slug } });
      if (existing) {
        req.session.articleErrors = [{ field: 'slug', message: 'Slug already exists' }];
        req.session.articleFormData = formData;
        req.session.articleMessage = null;
        return res.redirect('/admin/articles/new#article-feedback-anchor');
      }

      const article = await BlogPost.create({
        title,
        slug,
        excerpt,
        content,
        featuredImage: resolveFeaturedImage(req),
        category: req.body.category || null,
        tags: parseArticleTags(req.body.tags),
        seoTitle: req.body.seoTitle || title,
        metaDescription: req.body.metaDescription || excerpt,
        keywords: req.body.keywords || null,
        published: req.body.published === 'on',
        publishDate: req.body.published === 'on' ? new Date() : null,
        authorId: req.session.user.id,
      });

      req.session.success = 'Article created successfully!';
      req.session.articleErrors = [];
      req.session.articleFormData = {};
      req.session.articleMessage = 'Article created successfully!';
      res.redirect(`/admin/articles/${article.id}/edit`);
    } catch (error) {
      req.session.articleErrors = [
        {
          field: 'form',
          message: error?.message || 'Unable to create the article right now. Please try again.',
        },
      ];
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
      return res.redirect('/admin/articles/new#article-feedback-anchor');
    }
  }

  // Edit article form
  static async editArticle(req, res, next) {
    try {
      const { id } = req.params;
      const errors = req.session.articleErrors || [];
      const formData = req.session.articleFormData || {};
      const articleMessage = req.session.articleMessage || null;

      req.session.articleErrors = [];
      req.session.articleFormData = {};
      req.session.articleMessage = null;

      const article = await BlogPost.findByPk(id);
      if (!article) {
        return res.status(404).render('pages/404', { title: 'Article Not Found' });
      }

      res.render('admin/article-form', {
        title: 'Edit Article',
        article,
        isNew: false,
        errors,
        formData,
        articleMessage,
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
      const formData = {
        title: req.body.title || '',
        slug: req.body.slug || '',
        excerpt: req.body.excerpt || '',
        content: req.body.content || '',
        category: req.body.category || '',
        tags: req.body.tags || '',
        seoTitle: req.body.seoTitle || '',
        metaDescription: req.body.metaDescription || '',
        keywords: req.body.keywords || '',
        published: req.body.published === 'on' ? 'on' : '',
      };

      const article = await BlogPost.findByPk(id);
      if (!article) {
        return res.status(404).render('pages/404', { title: 'Article Not Found' });
      }

      // Check if slug is being changed and if new slug already exists
      if (slug !== article.slug) {
        const existing = await BlogPost.findOne({ where: { slug } });
        if (existing) {
          req.session.articleErrors = [{ field: 'slug', message: 'Slug already exists' }];
          req.session.articleFormData = formData;
          req.session.articleMessage = null;
          return res.redirect(`/admin/articles/${article.id}/edit#article-feedback-anchor`);
        }
      }

      const featuredImage = resolveFeaturedImage(req, article);

      await article.update({
        title,
        slug,
        excerpt,
        content,
        featuredImage,
        category: req.body.category || null,
        tags: parseArticleTags(req.body.tags),
        seoTitle: req.body.seoTitle || title,
        metaDescription: req.body.metaDescription || excerpt,
        keywords: req.body.keywords || null,
        published: req.body.published === 'on',
        publishDate: req.body.published === 'on' && !article.publishDate ? new Date() : article.publishDate,
      });

      req.session.success = 'Article updated successfully!';
      req.session.articleErrors = [];
      req.session.articleFormData = {};
      req.session.articleMessage = 'Article updated successfully!';
      res.redirect('/admin/articles');
    } catch (error) {
      req.session.articleErrors = [
        {
          field: 'form',
          message: error?.message || 'Unable to update the article right now. Please try again.',
        },
      ];
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
      return res.redirect(`/admin/articles/${req.params.id}/edit#article-feedback-anchor`);
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
      const mediaFiles = await listMediaFiles();
      const mediaMessage = req.session.mediaMessage || null;
      const mediaError = req.session.mediaError || null;

      req.session.mediaMessage = null;
      req.session.mediaError = null;

      res.render('admin/media', {
        title: 'Media Library',
        mediaFiles,
        mediaMessage,
        mediaError,
      });
    } catch (error) {
      next(error);
    }
  }

  // Upload media
  static async uploadMedia(req, res, next) {
    try {
      const wantsJson = req.accepts(['json', 'html']) === 'json' && !req.accepts('html');

      if (!req.file) {
        if (wantsJson) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        req.session.mediaError = 'No file uploaded.';
        return res.redirect('/admin/media#media-feedback-anchor');
      }

      const uploadedMedia = {
        success: true,
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
      };

      if (wantsJson) {
        return res.json(uploadedMedia);
      }

      req.session.mediaMessage = 'Media uploaded successfully.';
      req.session.mediaError = null;
      return res.redirect('/admin/media#media-feedback-anchor');
    } catch (error) {
      const wantsJson = req.accepts(['json', 'html']) === 'json' && !req.accepts('html');

      if (wantsJson) {
        return res.status(500).json({ error: error.message || 'Unable to upload media.' });
      }

      req.session.mediaError = error.message || 'Unable to upload media.';
      return res.redirect('/admin/media#media-feedback-anchor');
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
