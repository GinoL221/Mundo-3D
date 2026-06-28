import rateLimit from 'express-rate-limit';

const windowMs = process.env.LOGIN_LIMIT_WINDOW
  ? parseInt(process.env.LOGIN_LIMIT_WINDOW, 10)
  : 15 * 60 * 1000; // 15 minutes

const max = process.env.LOGIN_LIMIT_MAX
  ? parseInt(process.env.LOGIN_LIMIT_MAX, 10)
  : 5;

const loginLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
  },
  statusCode: 429,
});

export default loginLimiter;
