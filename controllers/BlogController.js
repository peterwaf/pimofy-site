const { BlogPost, User } = require('../models');
const { Op } = require('sequelize');

const POSTS_PER_PAGE = 6;
const DEFAULT_CATEGORY = 'Uncategorized';

function normalizeCategory(value) {
  const normalized = String(value || '').trim();
  return normalized || DEFAULT_CATEGORY;
}

function hasTag(tags, expectedTag) {
  const normalizedExpected = String(expectedTag || '').trim().toLowerCase();
  if (!normalizedExpected || !Array.isArray(tags)) {
    return false;
  }

  return tags.some((tag) => String(tag || '').trim().toLowerCase() === normalizedExpected);
}

function buildCategoryWhereClause(category) {
  if (category === DEFAULT_CATEGORY) {
    return {
      [Op.or]: [{ category: DEFAULT_CATEGORY }, { category: null }, { category: '' }],
    };
  }

  return { category };
}

class BlogController {
  // List all published blog posts with pagination
  static async index(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const offset = (page - 1) * POSTS_PER_PAGE;

      const { count, rows: posts } = await BlogPost.findAndCountAll({
        where: { published: true },
        include: [{ model: User, as: 'author', attributes: ['name', 'email'] }],
        order: [['publishDate', 'DESC']],
        limit: POSTS_PER_PAGE,
        offset,
      });

      const totalPages = Math.ceil(count / POSTS_PER_PAGE);

      // Get unique categories and tags
      const categories = await BlogPost.findAll({
        where: { published: true },
        attributes: [[BlogPost.sequelize.fn('DISTINCT', BlogPost.sequelize.col('category')), 'category']],
        raw: true,
      });

      const normalizedCategories = Array.from(
        new Set(
          categories
            .map((c) => normalizeCategory(c.category))
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right));

      res.render('blog/index', {
        title: 'Resources & Insights | Pimofy Digital',
        description: 'Read practical insights on data operations, capacity, and scaling for SaaS and Ecommerce teams.',
        posts,
        currentPage: page,
        totalPages,
        categories: normalizedCategories,
      });
    } catch (error) {
      next(error);
    }
  }

  // Show single blog post
  static async show(req, res, next) {
    try {
      const { slug } = req.params;

      const post = await BlogPost.findOne({
        where: { slug, published: true },
        include: [{ model: User, as: 'author', attributes: ['name', 'email'] }],
      });

      if (!post) {
        return res.status(404).render('pages/404', {
          title: 'Article Not Found',
          description: 'The article you are looking for does not exist.',
        });
      }

      // Increment view count
      await post.increment('views');

      // Get related posts by category
      const normalizedPostCategory = normalizeCategory(post.category);
      const related = await BlogPost.findAll({
        where: {
          published: true,
          ...buildCategoryWhereClause(normalizedPostCategory),
          id: { [Op.ne]: post.id },
        },
        limit: 3,
        order: [['publishDate', 'DESC']],
      });

      // Calculate reading time (rough estimate: 200 words per minute)
      const wordCount = post.content.split(/\s+/).length;
      const readingTime = Math.ceil(wordCount / 200);

      res.render('blog/show', {
        title: post.seoTitle || post.title,
        description: post.metaDescription || post.excerpt,
        post,
        related,
        readingTime,
        keywords: post.keywords,
      });
    } catch (error) {
      next(error);
    }
  }

  // Filter by category
  static async byCategory(req, res, next) {
    try {
      const category = normalizeCategory(req.params.category);
      const page = parseInt(req.query.page) || 1;
      const offset = (page - 1) * POSTS_PER_PAGE;

      const { count, rows: posts } = await BlogPost.findAndCountAll({
        where: {
          published: true,
          ...buildCategoryWhereClause(category),
        },
        include: [{ model: User, as: 'author', attributes: ['name', 'email'] }],
        order: [['publishDate', 'DESC']],
        limit: POSTS_PER_PAGE,
        offset,
      });

      if (count === 0) {
        return res.status(404).render('pages/404', {
          title: 'Category Not Found',
          description: `No articles found in the category "${category}".`,
        });
      }

      const totalPages = Math.ceil(count / POSTS_PER_PAGE);

      res.render('blog/index', {
        title: `${category} | Pimofy Digital`,
        description: `Articles about ${category}`,
        posts,
        currentPage: page,
        totalPages,
        filterCategory: category,
      });
    } catch (error) {
      next(error);
    }
  }

  // Filter by tag
  static async byTag(req, res, next) {
    try {
      const { tag } = req.params;
      const page = parseInt(req.query.page) || 1;

      const publishedPosts = await BlogPost.findAll({
        where: { published: true },
        include: [{ model: User, as: 'author', attributes: ['name', 'email'] }],
        order: [['publishDate', 'DESC']],
      });

      const matchingPosts = publishedPosts.filter((post) => hasTag(post.tags, tag));
      const count = matchingPosts.length;
      const offset = (page - 1) * POSTS_PER_PAGE;
      const posts = matchingPosts.slice(offset, offset + POSTS_PER_PAGE);

      if (count === 0) {
        return res.status(404).render('pages/404', {
          title: 'Tag Not Found',
          description: `No articles found with the tag "${tag}".`,
        });
      }

      const totalPages = Math.ceil(count / POSTS_PER_PAGE);

      res.render('blog/index', {
        title: `${tag} | Pimofy Digital`,
        description: `Articles tagged with ${tag}`,
        posts,
        currentPage: page,
        totalPages,
        filterTag: tag,
      });
    } catch (error) {
      next(error);
    }
  }

  // Search blog posts
  static async search(req, res, next) {
    try {
      const { q } = req.query;

      if (!q || q.trim().length < 2) {
        return res.render('blog/search', {
          title: 'Search',
          description: 'Search our blog articles',
          posts: [],
          query: '',
        });
      }

      const posts = await BlogPost.findAll({
        where: {
          published: true,
          [Op.or]: [
            { title: { [Op.iLike]: `%${q}%` } },
            { excerpt: { [Op.iLike]: `%${q}%` } },
            { content: { [Op.iLike]: `%${q}%` } },
          ],
        },
        include: [{ model: User, as: 'author', attributes: ['name', 'email'] }],
        order: [['publishDate', 'DESC']],
      });

      res.render('blog/search', {
        title: `Search: "${q}" | Pimofy Digital`,
        description: `Search results for "${q}"`,
        posts,
        query: q,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BlogController;
