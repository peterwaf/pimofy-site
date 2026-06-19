const { BlogPost, User } = require('../models');
const { Op } = require('sequelize');

const POSTS_PER_PAGE = 6;

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

      res.render('blog/index', {
        title: 'Resources & Insights | Pimofy Digital',
        description: 'Read practical insights on data operations, capacity, and scaling for SaaS and Ecommerce teams.',
        posts,
        currentPage: page,
        totalPages,
        categories: categories.map((c) => c.category).filter(Boolean),
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
      const related = await BlogPost.findAll({
        where: {
          published: true,
          category: post.category,
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
      const { category } = req.params;
      const page = parseInt(req.query.page) || 1;
      const offset = (page - 1) * POSTS_PER_PAGE;

      const { count, rows: posts } = await BlogPost.findAndCountAll({
        where: { published: true, category },
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
      const offset = (page - 1) * POSTS_PER_PAGE;

      // Find posts where tags array contains the tag
      const { count, rows: posts } = await BlogPost.findAndCountAll({
        where: {
          published: true,
          tags: {
            [Op.contains]: [tag],
          },
        },
        include: [{ model: User, as: 'author', attributes: ['name', 'email'] }],
        order: [['publishDate', 'DESC']],
        limit: POSTS_PER_PAGE,
        offset,
      });

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
