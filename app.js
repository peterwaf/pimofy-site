const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const config = require('./config/environment');
const { csrfTokenMiddleware, csrfProtectionMiddleware } = require('./middleware/csrf');
const { sequelize } = require('./models');

function resolveRuntimePath(...segments) {
  const fromCwd = path.join(process.cwd(), ...segments);
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }

  return path.join(__dirname, ...segments);
}

function getRequestBaseUrl(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const protocol = forwardedProto || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  if (host) {
    return `${protocol}://${host}`;
  }

  return config.app.url || 'http://localhost:3000';
}

function buildCanonicalUrl(req) {
  try {
    return new URL(req.originalUrl || '/', getRequestBaseUrl(req)).toString();
  } catch (error) {
    return config.app.url || 'http://localhost:3000';
  }
}

// Create Express app
const app = express();

if (config.app.isProduction) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: config.app.isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

if (config.app.isProduction) {
  app.use(limiter);
}

// ============================================
// VIEW ENGINE CONFIGURATION
// ============================================
app.set('view engine', 'ejs');
app.set('views', resolveRuntimePath('views'));

// ============================================
// BODY PARSER & FORM DATA
// ============================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ============================================
// SESSION CONFIGURATION
// ============================================
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'sessions',
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 24 * 60 * 60 * 1000,
});

app.use(
  session({
    name: 'pimofy.sid',
    secret: config.session.secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.app.isProduction, // HTTPS only in production
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

app.locals.sessionStore = sessionStore;

// ============================================
// STATIC FILES
// ============================================
app.use(express.static(resolveRuntimePath('public')));
app.use('/assets', express.static(resolveRuntimePath('assets')));

// Keep legacy static file URLs from the original HTML site working.
app.get(['/styles.css', '/css/styles.css'], (req, res) => {
  res.sendFile(resolveRuntimePath('styles.css'));
});

app.get(['/script.js', '/js/script.js'], (req, res) => {
  res.sendFile(resolveRuntimePath('script.js'));
});

// ============================================
// GLOBAL MIDDLEWARE / HELPERS
// ============================================

// Make config available to all views
app.use((req, res, next) => {
  res.locals.config = config;
  res.locals.user = req.session.user || null;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.currentPath = req.path;
  res.locals.taxonomySummary = res.locals.taxonomySummary || null;
  res.locals.siteUrl = getRequestBaseUrl(req);
  res.locals.canonicalUrl = buildCanonicalUrl(req);
  next();
});

app.use(csrfTokenMiddleware);
app.use(csrfProtectionMiddleware);

// Render all views through the main layout unless explicitly disabled.
app.use((req, res, next) => {
  const defaultRender = res.render.bind(res);

  res.render = (view, options, callback) => {
    let renderOptions = options;
    let renderCallback = callback;

    if (typeof options === 'function') {
      renderCallback = options;
      renderOptions = {};
    }

    renderOptions = renderOptions || {};

    if (view.startsWith('layouts/') || renderOptions.layout === false) {
      return defaultRender(view, renderOptions, renderCallback);
    }

    const { layout, ...viewOptions } = renderOptions;
    const layoutTemplate = layout || res.locals.layout || 'layouts/main';

    const layoutOptions = {
      ...viewOptions,
      template: `../${view}`,
    };

    return defaultRender(layoutTemplate, layoutOptions, renderCallback);
  };

  next();
});

// ============================================
// ROUTES
// ============================================

// Public routes
app.use('/', require('./routes/pages'));
app.use('/blog', require('./routes/blog'));
app.use('/auth', require('./routes/auth'));
app.use('/contact', require('./routes/contact'));

// Admin routes (protected)
app.use('/admin', require('./routes/admin'));

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).render('pages/404', {
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist.',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'An unexpected error occurred';

  console.error(`[Error ${status}] ${message}`, err);

  res.status(status).render('pages/error', {
    title: 'Error',
    description: message,
    status,
    error: config.app.isDevelopment ? err : {},
  });
});

module.exports = app;
