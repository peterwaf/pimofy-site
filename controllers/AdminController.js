const { BlogPost, User } = require('../models');
const { Op } = require('sequelize');
const bcryptjs = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const MEDIA_UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'blog-posts');
const MEDIA_URL_PREFIX = '/uploads/blog-posts';
const DEFAULT_CATEGORY = 'Uncategorized';
const TAXONOMY_CONFIG_PATH = path.join(__dirname, '..', 'config', 'taxonomy.json');

function normalizeCategory(value) {
  const normalized = String(value || '').trim();
  return normalized || DEFAULT_CATEGORY;
}

function normalizeTag(value) {
  return String(value || '').trim();
}

function normalizeTaxonomyList(values) {
  const seen = new Set();
  const results = [];

  (values || []).forEach((value) => {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    results.push(normalized);
  });

  return results;
}

async function loadTaxonomyConfig() {
  if (!fs.existsSync(TAXONOMY_CONFIG_PATH)) {
    const initial = { categories: [DEFAULT_CATEGORY], tags: [] };
    await fs.promises.writeFile(TAXONOMY_CONFIG_PATH, `${JSON.stringify(initial, null, 2)}\n`, 'utf8');
    return initial;
  }

  try {
    const raw = await fs.promises.readFile(TAXONOMY_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return {
      categories: normalizeTaxonomyList([DEFAULT_CATEGORY, ...(Array.isArray(parsed.categories) ? parsed.categories : [])]),
      tags: normalizeTaxonomyList(Array.isArray(parsed.tags) ? parsed.tags : []),
    };
  } catch (error) {
    return { categories: [DEFAULT_CATEGORY], tags: [] };
  }
}

async function saveTaxonomyConfig(config) {
  const normalized = {
    categories: normalizeTaxonomyList([DEFAULT_CATEGORY, ...((config && config.categories) || [])]),
    tags: normalizeTaxonomyList((config && config.tags) || []),
  };

  await fs.promises.writeFile(TAXONOMY_CONFIG_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function decodeTaxonomyTerm(value) {
  return decodeURIComponent(String(value || '').trim());
}

function redirectWithSessionSave(req, res, location) {
  if (!req.session || typeof req.session.save !== 'function') {
    return res.redirect(location);
  }

  return req.session.save(() => {
    res.redirect(location);
  });
}

async function getArticleCategoryOptions() {
  const taxonomyConfig = await loadTaxonomyConfig();
  const rows = await BlogPost.findAll({
    attributes: [[BlogPost.sequelize.fn('DISTINCT', BlogPost.sequelize.col('category')), 'category']],
    raw: true,
  });

  const uniqueCategories = Array.from(
    new Set(
      [...taxonomyConfig.categories, ...rows.map((row) => row.category)]
        .map((value) => normalizeCategory(value))
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));

  return [DEFAULT_CATEGORY, ...uniqueCategories.filter((category) => category !== DEFAULT_CATEGORY)];
}

function uniqueTags(values) {
  const seen = new Set();
  const results = [];

  values.forEach((value) => {
    const normalized = normalizeTag(value);
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    results.push(normalized);
  });

  return results;
}

function hasTag(tags, expectedTag) {
  const normalizedExpected = normalizeTag(expectedTag).toLowerCase();
  if (!normalizedExpected || !Array.isArray(tags)) {
    return false;
  }

  return tags.some((tag) => normalizeTag(tag).toLowerCase() === normalizedExpected);
}

async function getArticleTagOptions() {
  const taxonomyConfig = await loadTaxonomyConfig();
  const rows = await BlogPost.findAll({
    attributes: ['tags'],
    raw: true,
  });

  const tagValues = [...taxonomyConfig.tags];
  rows.forEach((row) => {
    if (Array.isArray(row.tags)) {
      tagValues.push(...row.tags);
    }
  });

  return uniqueTags(tagValues).sort((left, right) => left.localeCompare(right));
}

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
  return uniqueTags(raw
    .split(separator)
    .map((tag) => tag.trim())
    .filter(Boolean));
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

  return uniqueTags(raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean));
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
    category: normalizeCategory(body.category ?? current.category ?? ''),
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
  const files = [];

  if (!fs.existsSync(MEDIA_UPLOAD_DIR)) {
    return files;
  }

  const entries = await fs.promises.readdir(MEDIA_UPLOAD_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !isImageFile(entry.name)) {
      continue;
    }

    const fullPath = path.join(MEDIA_UPLOAD_DIR, entry.name);
    const stat = await fs.promises.stat(fullPath);

    files.push({
      filename: entry.name,
      url: `${MEDIA_URL_PREFIX}/${entry.name}`,
      size: stat.size,
      updatedAt: stat.mtime,
      createdAt: stat.birthtime,
    });
  }

  return files.sort((left, right) => right.updatedAt - left.updatedAt);
}

function getMediaFilenameFromParam(value) {
  return path.basename(decodeURIComponent(String(value || '').trim()));
}

function normalizeMediaFilename(value, fallbackExtension) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const incomingName = path.basename(raw);
  const explicitExtension = path.extname(incomingName).toLowerCase();
  const baseName = explicitExtension ? incomingName.slice(0, -explicitExtension.length) : incomingName;
  const safeBase = slugify(baseName);
  const extension = explicitExtension || fallbackExtension;

  if (!safeBase || !extension || !isImageFile(`x${extension}`)) {
    return '';
  }

  return `${safeBase}${extension}`;
}

function normalizeMediaSort(value) {
  const allowed = ['updated_desc', 'updated_asc', 'name_asc', 'name_desc', 'size_desc', 'size_asc'];
  const incoming = String(value || '').trim().toLowerCase();
  return allowed.includes(incoming) ? incoming : 'updated_desc';
}

function normalizePerPage(value) {
  const allowed = [6, 12, 24, 48];
  const parsed = parseInt(value, 10);
  return allowed.includes(parsed) ? parsed : 12;
}

function normalizePage(value, totalPages) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, Math.max(totalPages, 1));
}

function getMediaReturnTo(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 500 || !raw.startsWith('?')) {
    return '';
  }

  const queryOnly = raw.split('#')[0];
  return queryOnly;
}

function buildMediaRedirectUrl(returnTo) {
  return `/admin/media${returnTo || ''}#media-feedback-anchor`;
}

function buildMediaListUrl(filters, page) {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set('q', filters.q);
  }
  params.set('sort', filters.sort);
  params.set('perPage', String(filters.perPage));
  params.set('page', String(page));
  return `/admin/media?${params.toString()}`;
}

function buildArticleListUrl(filters, page) {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set('q', filters.q);
  }
  if (filters.category) {
    params.set('category', filters.category);
  }
  if (filters.tag) {
    params.set('tag', filters.tag);
  }
  params.set('page', String(page));
  return `/admin/articles?${params.toString()}`;
}

function taxonomyRedirectUrl(section = 'categories') {
  return `/admin/taxonomy/${section}#taxonomy-feedback-anchor`;
}

async function buildTaxonomyManagementData() {
  const taxonomyConfig = await loadTaxonomyConfig();
  const posts = await BlogPost.findAll({
    attributes: ['category', 'tags'],
    raw: true,
  });

  const categoryCounts = new Map();
  const tagCounts = new Map();

  taxonomyConfig.categories.forEach((category) => {
    categoryCounts.set(category, 0);
  });

  taxonomyConfig.tags.forEach((tag) => {
    tagCounts.set(tag, 0);
  });

  posts.forEach((post) => {
    const category = normalizeCategory(post.category);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

    const tags = Array.isArray(post.tags) ? uniqueTags(post.tags) : [];
    tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  const categories = Array.from(categoryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const tags = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return { categories, tags };
}

async function buildTaxonomySummary() {
  const taxonomyData = await buildTaxonomyManagementData();

  return {
    categoriesCount: taxonomyData.categories.length,
    tagsCount: taxonomyData.tags.length,
    categoriesInUse: taxonomyData.categories.filter((category) => category.count > 0).length,
    tagsInUse: taxonomyData.tags.filter((tag) => tag.count > 0).length,
  };
}

async function buildAdminNavSummary() {
  const [taxonomySummary, articlesCount] = await Promise.all([
    buildTaxonomySummary(),
    BlogPost.count(),
  ]);

  return {
    ...taxonomySummary,
    articlesCount,
  };
}

async function reassignCategoryForPosts(sourceCategory, targetCategory) {
  await BlogPost.update(
    { category: targetCategory },
    {
      where: {
        category: sourceCategory,
      },
    }
  );
}

async function clearCategoryFromPosts(sourceCategory) {
  await BlogPost.update(
    { category: DEFAULT_CATEGORY },
    {
      where: {
        category: sourceCategory,
      },
    }
  );
}

async function renameTagForPosts(sourceTag, targetTag) {
  const posts = await BlogPost.findAll();

  for (const post of posts) {
    const currentTags = Array.isArray(post.tags) ? post.tags : [];
    if (!hasTag(currentTags, sourceTag)) {
      continue;
    }

    const nextTags = uniqueTags(
      currentTags.map((tag) => {
        return String(tag).toLowerCase() === String(sourceTag).toLowerCase() ? targetTag : tag;
      })
    );

    await post.update({ tags: nextTags });
  }
}

async function removeTagFromPosts(tagToRemove) {
  const posts = await BlogPost.findAll();

  for (const post of posts) {
    const currentTags = Array.isArray(post.tags) ? post.tags : [];
    if (!hasTag(currentTags, tagToRemove)) {
      continue;
    }

    const nextTags = currentTags.filter((tag) => String(tag).toLowerCase() !== String(tagToRemove).toLowerCase());
    await post.update({ tags: uniqueTags(nextTags) });
  }
}

class AdminController {
  static async getTaxonomySummary() {
    return buildAdminNavSummary();
  }

  // Dashboard
  static async dashboard(req, res, next) {
    try {
      const totalArticles = await BlogPost.count();
      const publishedArticles = await BlogPost.count({ where: { published: true } });
      const draftArticles = totalArticles - publishedArticles;
      const totalUsers = await User.count();
      const recentArticles = await BlogPost.findAll({
        include: [{ model: User, as: 'author', attributes: ['name'] }],
        order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']],
        limit: 3,
      });

      res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        totalArticles,
        publishedArticles,
        draftArticles,
        totalUsers,
        recentArticles,
      });
    } catch (error) {
      next(error);
    }
  }

  // List articles
  static async articles(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = 10;

      const q = String(req.query.q || '').trim();
      const category = String(req.query.category || '').trim();
      const tag = String(req.query.tag || '').trim();

      const where = {};
      if (q) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${q}%` } },
          { slug: { [Op.iLike]: `%${q}%` } },
          { excerpt: { [Op.iLike]: `%${q}%` } },
        ];
      }

      if (category) {
        if (category === DEFAULT_CATEGORY) {
          where[Op.and] = where[Op.and] || [];
          where[Op.and].push({
            [Op.or]: [{ category: DEFAULT_CATEGORY }, { category: null }, { category: '' }],
          });
        } else {
          where.category = category;
        }
      }

      const allArticles = await BlogPost.findAll({
        where,
        include: [{ model: User, as: 'author', attributes: ['name'] }],
        order: [['createdAt', 'DESC']],
      });

      const matchingArticles = tag
        ? allArticles.filter((article) => hasTag(article.tags, tag))
        : allArticles;

      const count = matchingArticles.length;
      const offset = (page - 1) * limit;
      const articles = matchingArticles.slice(offset, offset + limit);

      const totalPages = Math.ceil(count / limit);
      const categoryOptions = await getArticleCategoryOptions();
      const tagOptions = await getArticleTagOptions();
      const filters = { q, category, tag };

      res.render('admin/articles', {
        title: 'Articles',
        articles,
        currentPage: page,
        totalPages,
        articleFilters: filters,
        categoryOptions,
        tagOptions,
        prevPageUrl: page > 1 ? buildArticleListUrl(filters, page - 1) : null,
        nextPageUrl: page < totalPages ? buildArticleListUrl(filters, page + 1) : null,
      });
    } catch (error) {
      next(error);
    }
  }

  // Taxonomy management
  static async taxonomy(req, res, next) {
    try {
      const taxonomySummary = await buildTaxonomySummary();

      res.render('admin/taxonomy-overview', {
        title: 'Taxonomies',
        taxonomySummary,
      });
    } catch (error) {
      next(error);
    }
  }

  static async taxonomyCategories(req, res, next) {
    try {
      const taxonomyMessage = req.session.taxonomyMessage || null;
      const taxonomyError = req.session.taxonomyError || null;
      req.session.taxonomyMessage = null;
      req.session.taxonomyError = null;

      const taxonomyData = await buildTaxonomyManagementData();

      res.render('admin/taxonomy-manager', {
        title: 'Manage Categories',
        taxonomySection: 'categories',
        categories: taxonomyData.categories,
        taxonomyMessage,
        taxonomyError,
      });
    } catch (error) {
      next(error);
    }
  }

  static async taxonomyTags(req, res, next) {
    try {
      const taxonomyMessage = req.session.taxonomyMessage || null;
      const taxonomyError = req.session.taxonomyError || null;
      req.session.taxonomyMessage = null;
      req.session.taxonomyError = null;

      const taxonomyData = await buildTaxonomyManagementData();

      res.render('admin/taxonomy-manager', {
        title: 'Manage Tags',
        taxonomySection: 'tags',
        tags: taxonomyData.tags,
        taxonomyMessage,
        taxonomyError,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req, res, next) {
    try {
      const rawName = String(req.body.name || '').trim();
      if (!rawName) {
        req.session.taxonomyError = 'Category name is required.';
        return redirectWithSessionSave(req, res, taxonomyRedirectUrl('categories'));
      }

      const name = normalizeCategory(rawName);
      const taxonomyConfig = await loadTaxonomyConfig();
      const exists = taxonomyConfig.categories.some((category) => category.toLowerCase() === name.toLowerCase());

      if (!exists) {
        taxonomyConfig.categories.push(name);
        await saveTaxonomyConfig(taxonomyConfig);
      }

      req.session.taxonomyMessage = exists
        ? `Category "${name}" already exists.`
        : `Category "${name}" created successfully.`;
      req.session.taxonomyError = null;
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('categories'));
    } catch (error) {
      req.session.taxonomyError = error.message || 'Unable to create category.';
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('categories'));
    }
  }

  static async renameCategory(req, res, next) {
    try {
      const source = normalizeCategory(decodeTaxonomyTerm(req.params.name));
      const target = normalizeCategory(req.body.newName);

      if (source === DEFAULT_CATEGORY) {
        req.session.taxonomyError = 'Uncategorized cannot be renamed.';
        return redirectWithSessionSave(req, res, taxonomyRedirectUrl('categories'));
      }

      const taxonomyConfig = await loadTaxonomyConfig();
      taxonomyConfig.categories = taxonomyConfig.categories.filter((category) => category.toLowerCase() !== source.toLowerCase());

      if (!taxonomyConfig.categories.some((category) => category.toLowerCase() === target.toLowerCase())) {
        taxonomyConfig.categories.push(target);
      }

      await reassignCategoryForPosts(source, target);
      await saveTaxonomyConfig(taxonomyConfig);

      req.session.taxonomyMessage = `Category "${source}" updated to "${target}".`;
      req.session.taxonomyError = null;
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('categories'));
    } catch (error) {
      req.session.taxonomyError = error.message || 'Unable to rename category.';
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('categories'));
    }
  }

  static async deleteCategory(req, res, next) {
    try {
      const source = normalizeCategory(decodeTaxonomyTerm(req.params.name));
      if (source === DEFAULT_CATEGORY) {
        req.session.taxonomyError = 'Uncategorized cannot be deleted.';
        return redirectWithSessionSave(req, res, taxonomyRedirectUrl('categories'));
      }

      const taxonomyConfig = await loadTaxonomyConfig();
      taxonomyConfig.categories = taxonomyConfig.categories.filter((category) => category.toLowerCase() !== source.toLowerCase());

      await clearCategoryFromPosts(source);
      await saveTaxonomyConfig(taxonomyConfig);

      req.session.taxonomyMessage = `Category "${source}" removed. Related articles moved to Uncategorized.`;
      req.session.taxonomyError = null;
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('categories'));
    } catch (error) {
      req.session.taxonomyError = error.message || 'Unable to delete category.';
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('categories'));
    }
  }

  static async createTag(req, res, next) {
    try {
      const name = normalizeTag(req.body.name);
      if (!name) {
        req.session.taxonomyError = 'Tag name is required.';
        return redirectWithSessionSave(req, res, taxonomyRedirectUrl('tags'));
      }

      const taxonomyConfig = await loadTaxonomyConfig();
      const exists = taxonomyConfig.tags.some((tag) => tag.toLowerCase() === name.toLowerCase());
      if (!exists) {
        taxonomyConfig.tags.push(name);
        await saveTaxonomyConfig(taxonomyConfig);
      }

      req.session.taxonomyMessage = exists
        ? `Tag "${name}" already exists.`
        : `Tag "${name}" created successfully.`;
      req.session.taxonomyError = null;
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('tags'));
    } catch (error) {
      req.session.taxonomyError = error.message || 'Unable to create tag.';
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('tags'));
    }
  }

  static async renameTag(req, res, next) {
    try {
      const source = normalizeTag(decodeTaxonomyTerm(req.params.name));
      const target = normalizeTag(req.body.newName);

      if (!source || !target) {
        req.session.taxonomyError = 'Source and target tag names are required.';
        return redirectWithSessionSave(req, res, taxonomyRedirectUrl('tags'));
      }

      const taxonomyConfig = await loadTaxonomyConfig();
      taxonomyConfig.tags = taxonomyConfig.tags.filter((tag) => tag.toLowerCase() !== source.toLowerCase());
      if (!taxonomyConfig.tags.some((tag) => tag.toLowerCase() === target.toLowerCase())) {
        taxonomyConfig.tags.push(target);
      }

      await renameTagForPosts(source, target);
      await saveTaxonomyConfig(taxonomyConfig);

      req.session.taxonomyMessage = `Tag "${source}" updated to "${target}".`;
      req.session.taxonomyError = null;
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('tags'));
    } catch (error) {
      req.session.taxonomyError = error.message || 'Unable to rename tag.';
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('tags'));
    }
  }

  static async deleteTag(req, res, next) {
    try {
      const source = normalizeTag(decodeTaxonomyTerm(req.params.name));
      if (!source) {
        req.session.taxonomyError = 'Tag name is required.';
        return redirectWithSessionSave(req, res, taxonomyRedirectUrl('tags'));
      }

      const taxonomyConfig = await loadTaxonomyConfig();
      taxonomyConfig.tags = taxonomyConfig.tags.filter((tag) => tag.toLowerCase() !== source.toLowerCase());

      await removeTagFromPosts(source);
      await saveTaxonomyConfig(taxonomyConfig);

      req.session.taxonomyMessage = `Tag "${source}" deleted.`;
      req.session.taxonomyError = null;
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('tags'));
    } catch (error) {
      req.session.taxonomyError = error.message || 'Unable to delete tag.';
      return redirectWithSessionSave(req, res, taxonomyRedirectUrl('tags'));
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
          category: normalizeCategory(rowObject.category),
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
      const categoryOptions = await getArticleCategoryOptions();
      const tagOptions = await getArticleTagOptions();

      req.session.articleErrors = [];
      req.session.articleFormData = {};
      req.session.articleMessage = null;

      res.render('admin/article-form', {
        title: 'Create New Article',
        article: null,
        isNew: true,
        errors,
        formData,
        categoryOptions,
        tagOptions,
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
        return redirectWithSessionSave(req, res, '/admin/articles/new#article-feedback-anchor');
      }

      const article = await BlogPost.create({
        title,
        slug,
        excerpt,
        content,
        featuredImage: resolveFeaturedImage(req),
        category: normalizeCategory(req.body.category),
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
      return redirectWithSessionSave(req, res, `/admin/articles/${article.id}/edit`);
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
      return redirectWithSessionSave(req, res, '/admin/articles/new#article-feedback-anchor');
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

      const categoryOptions = await getArticleCategoryOptions();
      const tagOptions = await getArticleTagOptions();

      res.render('admin/article-form', {
        title: 'Edit Article',
        article,
        isNew: false,
        errors,
        formData,
        categoryOptions,
        tagOptions,
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
          return redirectWithSessionSave(req, res, `/admin/articles/${article.id}/edit#article-feedback-anchor`);
        }
      }

      const featuredImage = resolveFeaturedImage(req, article);

      await article.update({
        title,
        slug,
        excerpt,
        content,
        featuredImage,
        category: normalizeCategory(req.body.category),
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
      return redirectWithSessionSave(req, res, '/admin/articles');
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
      return redirectWithSessionSave(req, res, `/admin/articles/${req.params.id}/edit#article-feedback-anchor`);
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
      return redirectWithSessionSave(req, res, '/admin/articles');
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
      const allMediaFiles = await listMediaFiles();
      const mediaMessage = req.session.mediaMessage || null;
      const mediaError = req.session.mediaError || null;

      const q = String(req.query.q || '').trim();
      const sort = normalizeMediaSort(req.query.sort);
      const perPage = normalizePerPage(req.query.perPage);

      let filteredMediaFiles = allMediaFiles;
      if (q) {
        const normalizedQuery = q.toLowerCase();
        filteredMediaFiles = allMediaFiles.filter((media) => media.filename.toLowerCase().includes(normalizedQuery));
      }

      if (sort === 'updated_asc') {
        filteredMediaFiles.sort((left, right) => left.updatedAt - right.updatedAt);
      } else if (sort === 'name_asc') {
        filteredMediaFiles.sort((left, right) => left.filename.localeCompare(right.filename));
      } else if (sort === 'name_desc') {
        filteredMediaFiles.sort((left, right) => right.filename.localeCompare(left.filename));
      } else if (sort === 'size_desc') {
        filteredMediaFiles.sort((left, right) => right.size - left.size);
      } else if (sort === 'size_asc') {
        filteredMediaFiles.sort((left, right) => left.size - right.size);
      } else {
        filteredMediaFiles.sort((left, right) => right.updatedAt - left.updatedAt);
      }

      const totalItems = filteredMediaFiles.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
      const page = normalizePage(req.query.page, totalPages);
      const offset = (page - 1) * perPage;
      const mediaFiles = filteredMediaFiles.slice(offset, offset + perPage);

      const rangeStart = totalItems === 0 ? 0 : offset + 1;
      const rangeEnd = totalItems === 0 ? 0 : Math.min(offset + mediaFiles.length, totalItems);

      const filters = { q, sort, perPage };
      const mediaReturnToParams = new URLSearchParams();
      if (q) {
        mediaReturnToParams.set('q', q);
      }
      mediaReturnToParams.set('sort', sort);
      mediaReturnToParams.set('perPage', String(perPage));
      mediaReturnToParams.set('page', String(page));
      const mediaReturnTo = `?${mediaReturnToParams.toString()}`;

      const pageWindowStart = Math.max(1, page - 2);
      const pageWindowEnd = Math.min(totalPages, page + 2);
      const pageLinks = [];
      for (let current = pageWindowStart; current <= pageWindowEnd; current += 1) {
        pageLinks.push({ number: current, url: buildMediaListUrl(filters, current), active: current === page });
      }

      req.session.mediaMessage = null;
      req.session.mediaError = null;

      res.render('admin/media', {
        title: 'Media Library',
        mediaFiles,
        mediaFilters: filters,
        mediaPagination: {
          page,
          perPage,
          totalItems,
          totalPages,
          rangeStart,
          rangeEnd,
          prevUrl: page > 1 ? buildMediaListUrl(filters, page - 1) : null,
          nextUrl: page < totalPages ? buildMediaListUrl(filters, page + 1) : null,
          pageLinks,
        },
        mediaReturnTo,
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
      const returnTo = getMediaReturnTo(req.body.returnTo);
      const wantsJson = req.accepts(['json', 'html']) === 'json' && !req.accepts('html');

      if (!req.file) {
        if (wantsJson) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        req.session.mediaError = 'No file uploaded.';
        return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
      }

      const uploadedMedia = {
        success: true,
        filename: req.file.filename,
        path: `${MEDIA_URL_PREFIX}/${req.file.filename}`,
      };

      if (wantsJson) {
        return res.json(uploadedMedia);
      }

      req.session.mediaMessage = 'Media uploaded successfully.';
      req.session.mediaError = null;
      return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
    } catch (error) {
      const returnTo = getMediaReturnTo(req.body.returnTo);
      const wantsJson = req.accepts(['json', 'html']) === 'json' && !req.accepts('html');

      if (wantsJson) {
        return res.status(500).json({ error: error.message || 'Unable to upload media.' });
      }

      req.session.mediaError = error.message || 'Unable to upload media.';
      return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
    }
  }

  // Update media metadata (rename file)
  static async updateMedia(req, res, next) {
    try {
      const returnTo = getMediaReturnTo(req.body.returnTo);
      const currentFilename = getMediaFilenameFromParam(req.params.id);
      const currentPath = path.join(MEDIA_UPLOAD_DIR, currentFilename);

      if (!currentFilename || !fs.existsSync(currentPath) || !isImageFile(currentFilename)) {
        req.session.mediaError = 'Media file was not found.';
        return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
      }

      const currentExtension = path.extname(currentFilename).toLowerCase();
      const nextFilename = normalizeMediaFilename(req.body.filename, currentExtension);
      if (!nextFilename) {
        req.session.mediaError = 'Please provide a valid image filename.';
        return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
      }

      if (nextFilename === currentFilename) {
        req.session.mediaMessage = 'No changes were made to the media filename.';
        req.session.mediaError = null;
        return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
      }

      const nextPath = path.join(MEDIA_UPLOAD_DIR, nextFilename);
      if (fs.existsSync(nextPath)) {
        req.session.mediaError = 'A media file with that name already exists.';
        return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
      }

      await fs.promises.rename(currentPath, nextPath);

      req.session.mediaMessage = 'Media file renamed successfully.';
      req.session.mediaError = null;
      return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
    } catch (error) {
      const returnTo = getMediaReturnTo(req.body.returnTo);
      req.session.mediaError = error.message || 'Unable to update the media file.';
      return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
    }
  }

  // Delete media
  static async deleteMedia(req, res, next) {
    try {
      const returnTo = getMediaReturnTo(req.body.returnTo);
      const filename = getMediaFilenameFromParam(req.params.id);
      const filePath = path.join(MEDIA_UPLOAD_DIR, filename);

      if (!filename || !fs.existsSync(filePath) || !isImageFile(filename)) {
        req.session.mediaError = 'Media file was not found.';
        return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
      }

      await fs.promises.unlink(filePath);

      req.session.mediaMessage = 'Media deleted successfully.';
      req.session.mediaError = null;
      return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
    } catch (error) {
      const returnTo = getMediaReturnTo(req.body.returnTo);
      req.session.mediaError = error.message || 'Unable to delete media.';
      return redirectWithSessionSave(req, res, buildMediaRedirectUrl(returnTo));
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
      return redirectWithSessionSave(req, res, '/admin/users');
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
