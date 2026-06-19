const { validationResult } = require('express-validator');

function withFeedbackHash(url) {
  const target = String(url || '').trim() || '/';
  if (target.includes('#')) {
    return target;
  }
  return `${target}#contact-feedback-anchor`;
}

// Middleware to handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstErrorByField = new Map();
    errors.array().forEach((error) => {
      if (!firstErrorByField.has(error.param)) {
        firstErrorByField.set(error.param, {
          field: error.param,
          message: error.msg,
        });
      }
    });
    const errorMessages = Array.from(firstErrorByField.values());

    // Return JSON only for explicit API/JSON requests.
    const accepts = req.accepts(['html', 'json']);
    const isJsonBody = req.is('application/json');
    const wantsJsonOnly = accepts === 'json' && !req.accepts('html');

    if (isJsonBody || wantsJsonOnly) {
      return res.status(400).json({ errors: errorMessages });
    }

    // For form submissions, redirect back with error messages.
    // Helmet may omit Referer, so fall back to the current request URL.
    req.session.errors = errorMessages;
    req.session.formData = {
      name: req.body?.name || '',
      email: req.body?.email || '',
      company: req.body?.company || '',
      type: req.body?.type || '',
      website: req.body?.website || '',
      message: req.body?.message || '',
    };
    return res.redirect(withFeedbackHash(req.header('Referer') || req.originalUrl || '/'));
  }
  next();
}

module.exports = {
  handleValidationErrors,
};
