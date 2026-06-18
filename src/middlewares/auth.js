const jwt = require('jsonwebtoken');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

const isUser = (req, res, next) => {
  res.locals.isLogged ? next() : res.redirect('/login');
};

const guestMiddleware = (req, res, next) => {
  if (req.session.userLogged) {
    return res.redirect('/profile');
  }
  next();
};

const authMiddleware = (req, res, next) => {
  if (!req.session.userLogged) {
    return res.redirect('/login');
  }
  next();
};

// Verifies a Bearer JWT token on the Authorization header and attaches the
// decoded payload to req.user for downstream API route handlers.
const apiAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación no proporcionado' });
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token de autenticación inválido o expirado' });
  }
};

// Allows the request to proceed only when the caller is an administrator
// (IDRole === 1). Supports both web sessions (req.session.userLogged) and
// API requests authenticated via apiAuthMiddleware (req.user). Responds
// with JSON for /api paths and redirects/renders for web routes.
const adminGuard = (req, res, next) => {
  const isApiRequest = req.path.startsWith('/api');
  const principal = (req.session && req.session.userLogged) || req.user;

  if (!principal) {
    if (isApiRequest) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }
    return res.redirect('/login');
  }

  if (principal.IDRole !== 1) {
    if (isApiRequest) {
      return res.status(403).json({ error: 'Acceso restringido a administradores' });
    }
    return res.status(403).render(path.join(__dirname, '../views/403Forbidden.ejs'), {
      message: 'No tienes permisos de administrador para acceder a esta página.',
    });
  }

  next();
};

module.exports = {
  isUser,
  guestMiddleware,
  authMiddleware,
  apiAuthMiddleware,
  adminGuard,
};
