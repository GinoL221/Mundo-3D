const crypto = require('crypto');

/**
 * Simple session-based CSRF protection.
 * No external dependencies. Uses express-session to store the token.
 *
 * Flow:
 * 1. On GET requests: generate a token, store in session, expose via res.locals
 * 2. On POST/PUT/DELETE: validate submitted token against session token
 * 3. EJS forms include: <input type="hidden" name="_csrf" value="<%= csrfToken %>">
 */

/**
 * Generate a CSRF token and store it in the session.
 * Always called after session middleware.
 */
function generateToken(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  req.session.csrfToken = token;
  res.locals.csrfToken = token;
  return token;
}

/**
 * Middleware: on GET requests, generate a fresh CSRF token.
 * On POST/PUT/DELETE, validate the submitted token.
 */
function csrfProtection(req, res, next) {
  // Skip CSRF for API routes — they should use token-based auth instead
  if (req.path.startsWith('/api/')) {
    return next();
  }

  const method = req.method.toUpperCase();

  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Generate token for the next form submission
    generateToken(req, res);
    return next();
  }

  // POST, PUT, DELETE — validate the submitted token
  const submittedToken =
    (req.body && req.body._csrf) || req.headers['x-csrf-token'] || (req.query && req.query._csrf);

  const sessionToken = req.session && req.session.csrfToken;

  if (!submittedToken || !sessionToken) {
    return res.status(403).render(require('path').join(__dirname, '../views/404NotFound.ejs'), {
      message: 'Token CSRF inválido. Vuelve atrás e intenta de nuevo.',
    });
  }

  // Constant-time comparison to prevent timing attacks
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(submittedToken, 'hex'),
      Buffer.from(sessionToken, 'hex'),
    );

    if (!isValid) {
      return res.status(403).render(require('path').join(__dirname, '../views/404NotFound.ejs'), {
        message: 'Token CSRF inválido. Vuelve atrás e intenta de nuevo.',
      });
    }
  } catch (err) {
    // Tokens with different lengths will throw — treat as invalid
    return res.status(403).render(require('path').join(__dirname, '../views/404NotFound.ejs'), {
      message: 'Token CSRF inválido. Vuelve atrás e intenta de nuevo.',
    });
  }

  // Token is valid — generate a new one for the next request
  generateToken(req, res);
  next();
}

module.exports = { csrfProtection };
