const { BlogPost } = require('../models');

class PageController {
  // Home page
  static async home(req, res, next) {
    try {
      res.render('pages/home', {
        title: 'Dedicated Data Operations for SaaS & Ecommerce | Pimofy Digital',
        description:
          'Pimofy runs your data operations with a dedicated specialist, QA, and weekly reporting. 98% accuracy, 80% less backlog. Book a free capacity audit.',
        preloadImage: '/assets/hero-home.webp',
      });
    } catch (error) {
      next(error);
    }
  }

  // Solutions page
  static async solutions(req, res, next) {
    try {
      res.render('pages/solutions', {
        title: 'Data Operations Solutions for SaaS & Ecommerce | Pimofy',
        description:
          'One focused solution built around your data. Explore the Dedicated Data Operations Pod and a free Operations Capacity Audit for growing teams.',
        preloadImage: '/assets/data-warehouse.webp',
      });
    } catch (error) {
      next(error);
    }
  }

  // Data operations page
  static async dataOperations(req, res, next) {
    try {
      res.render('pages/data-operations', {
        title: 'The Data Operations Pod | Pimofy Digital',
        description:
          'Discover how Pimofy\'s Data Operations Pod combines specialists, QA, and reporting to restore team capacity without hiring overhead.',
        preloadImage: '/assets/data-specialist.webp',
      });
    } catch (error) {
      next(error);
    }
  }

  // Capacity audit page
  static async capacityAudit(req, res, next) {
    try {
      res.render('pages/capacity-audit', {
        title: 'Free Operations Capacity Audit | Pimofy Digital',
        description:
          'Book a free Operations Capacity Audit to identify repetitive data tasks, quantify lost hours, and map a practical execution plan.',
        preloadImage: '/assets/capacity-donut.webp',
      });
    } catch (error) {
      next(error);
    }
  }

  // Industries page
  static async industries(req, res, next) {
    try {
      res.render('pages/industries', {
        title: 'Industries | Pimofy Digital',
        description: 'Explore the industries we serve with specialized data operations solutions.',
      });
    } catch (error) {
      next(error);
    }
  }

  // About page
  static async about(req, res, next) {
    try {
      res.render('pages/about', {
        title: 'About Pimofy Digital',
        description: 'Learn about our team, our mission, and why we specialize in data operations.',
        preloadImage: '/assets/team.webp',
      });
    } catch (error) {
      next(error);
    }
  }

  // Resources page - redirect to blog
  static async resources(req, res) {
    res.redirect('/blog');
  }

  // Privacy page
  static async privacy(req, res, next) {
    try {
      res.render('pages/privacy', {
        title: 'Privacy Policy | Pimofy Digital',
        description: 'Privacy Policy for Pimofy Digital',
      });
    } catch (error) {
      next(error);
    }
  }

  // Terms page
  static async terms(req, res, next) {
    try {
      res.render('pages/terms', {
        title: 'Terms & Conditions | Pimofy Digital',
        description: 'Terms and Conditions for using Pimofy Digital services',
      });
    } catch (error) {
      next(error);
    }
  }

  // Dynamic sitemap.xml
  static async sitemap(req, res, next) {
    try {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');

      // Static pages
      const staticPages = [
        { url: '/', changefreq: 'weekly', priority: 1.0 },
        { url: '/solutions', changefreq: 'monthly', priority: 0.8 },
        { url: '/data-operations', changefreq: 'monthly', priority: 0.8 },
        { url: '/capacity-audit', changefreq: 'monthly', priority: 0.8 },
        { url: '/industries', changefreq: 'monthly', priority: 0.8 },
        { url: '/about', changefreq: 'monthly', priority: 0.7 },
        { url: '/blog', changefreq: 'weekly', priority: 0.9 },
        { url: '/contact', changefreq: 'monthly', priority: 0.8 },
        { url: '/privacy', changefreq: 'yearly', priority: 0.3 },
        { url: '/terms', changefreq: 'yearly', priority: 0.3 },
      ];

      // Get published blog posts
      const posts = await BlogPost.findAll({
        where: { published: true },
        attributes: ['slug', 'updatedAt'],
        order: [['publishDate', 'DESC']],
      });

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // Add static pages
      staticPages.forEach((page) => {
        const baseUrl = process.env.APP_URL || 'https://pimofydigital.com';
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += '  </url>\n';
      });

      // Add blog posts
      posts.forEach((post) => {
        const baseUrl = process.env.APP_URL || 'https://pimofydigital.com';
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/blog/${post.slug}</loc>\n`;
        xml += `    <lastmod>${post.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
        xml += '    <changefreq>monthly</changefreq>\n';
        xml += '    <priority>0.7</priority>\n';
        xml += '  </url>\n';
      });

      xml += '</urlset>';

      res.send(xml);
    } catch (error) {
      next(error);
    }
  }

  // robots.txt
  static async robots(req, res) {
    res.setHeader('Content-Type', 'text/plain');
    const baseUrl = process.env.APP_URL || 'https://pimofydigital.com';

    const content = `# Pimofy Digital Robots.txt
User-agent: *
Allow: /
Disallow: /admin
Disallow: /auth/login

Sitemap: ${baseUrl}/sitemap.xml
`;

    res.send(content);
  }
}

module.exports = PageController;
