const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for login attempts.
 * 5 attempts per 15 minutes per IP address.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
  },
  statusCode: 429,
});

module.exports = loginLimiter;
