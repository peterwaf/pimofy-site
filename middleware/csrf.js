const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_SEPARATOR = '.';

function getSession(req) {
  return req && req.session ? req.session : null;
}

function ensureSecret(req) {
  const session = getSession(req);
  if (!session) {
    return null;
  }

  if (!session.csrfSecret) {
    session.csrfSecret = crypto.randomBytes(32).toString('hex');
  }

  return session.csrfSecret;
}

function signNonce(secret, nonce) {
  return crypto.createHmac('sha256', secret).update(nonce).digest('hex');
}

function createCsrfToken(req) {
  const secret = ensureSecret(req);
  if (!secret) {
    return '';
  }

  const nonce = crypto.randomBytes(24).toString('hex');
  const signature = signNonce(secret, nonce);
  return `${nonce}${TOKEN_SEPARATOR}${signature}`;
}

function safeEqual(left, right) {
  const leftBuf = Buffer.from(String(left || ''), 'utf8');
  const rightBuf = Buffer.from(String(right || ''), 'utf8');

  if (leftBuf.length !== rightBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function readIncomingToken(req) {
  return (
    req.body?._csrf ||
    req.get('x-csrf-token') ||
    req.get('x-xsrf-token') ||
    req.query?._csrf ||
    ''
  );
}

function verifyCsrfToken(req, token) {
  const secret = ensureSecret(req);
  if (!secret || !token) {
    return false;
  }

  const raw = String(token);
  const separatorIndex = raw.indexOf(TOKEN_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) {
    return false;
  }

  const nonce = raw.slice(0, separatorIndex);
  const signature = raw.slice(separatorIndex + 1);
  if (!nonce || !signature) {
    return false;
  }

  const expectedSignature = signNonce(secret, nonce);
  return safeEqual(signature, expectedSignature);
}

function csrfTokenMiddleware(req, res, next) {
  res.locals.csrfToken = createCsrfToken(req);
  next();
}

function csrfProtectionMiddleware(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const token = readIncomingToken(req);
  if (verifyCsrfToken(req, token)) {
    return next();
  }

  const wantsJson = req.accepts(['json', 'html']) === 'json' && !req.accepts('html');
  if (wantsJson || req.is('application/json')) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  return res.status(403).render('pages/403', {
    title: 'Access Denied',
    description: 'Your session expired or this request could not be verified. Please refresh and try again.',
  });
}

module.exports = {
  csrfTokenMiddleware,
  csrfProtectionMiddleware,
};
