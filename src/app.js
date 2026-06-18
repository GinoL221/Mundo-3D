if (process.env.NODE_ENV !== 'test') {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required but not set in environment.');
  }
  if (!process.env.COOKIE_SECRET) {
    throw new Error('COOKIE_SECRET is required but not set in environment.');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required but not set in environment.');
  }
}

const express = require('express');
const morgan = require('morgan');
const methodOverride = require('method-override');
const helmet = require('helmet');

const session = require('express-session');
const cors = require('cors');

// Agregar cors al middleware
const path = require('path');

const mainRoutes = require('./routes/mainRoutes.js');

// Register ts-node dynamically to require TypeScript modules in JavaScript
require('ts-node/register');
const productsRoutes = require('./infrastructure/routes/productRoutes').default;
const userRoutes = require('./infrastructure/routes/userRoutes').default;


const apiRouter = require('./routes/api');
const cookies = require('cookie-parser');

const server = express();

// Configure views directory so res.render() can use view names instead of full paths
server.set('views', path.join(__dirname, 'views'));

const userLoggedMiddleware = require('./middlewares/userLogged');
const cartCountMiddleware = require('./middlewares/cartCount');
const errorHandler = require('./middlewares/errorHandler.js');
const { csrfProtection } = require('./middlewares/csrf.js');

// 1. Security headers (first)
server.use(helmet());

// 2. CORS headers
server.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
      if (!origin || origin === allowedOrigin) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
  }),
);

// 3. Static files
server.use(express.static(path.join(__dirname, '../public')));

// 4. Request logging
server.use(morgan('dev'));

// 5. Body parsing
server.use(express.urlencoded({ extended: false }));
server.use(express.json());

// 6. Method override
server.use(methodOverride('_method'));

// 7. Cookie parsing (MUST be before session and auth)
server.use(cookies(process.env.COOKIE_SECRET || 'test_cookie_secret'));

// 8. Session management
server.use(
  session({
    secret: process.env.SESSION_SECRET || 'test_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  }),
);

// 9. Auth middleware (reads req.cookies.userEmail)
server.use(userLoggedMiddleware);
server.use(cartCountMiddleware);

// 10. View engine
server.set('view engine', 'ejs');

// 11. CSRF protection (must be after session + cookie-parser + body parser)
server.use(csrfProtection);

// API routes (mounted at /api)
server.use('/api', apiRouter);

server.use(mainRoutes);
server.use(userRoutes);
server.use(productsRoutes);

//Ruta 404
server.use((req, res, next) => {
  res.status(404).render('404NotFound', { message: 'Dirección no encontrada' });
});

// Global error handler (must be last)
server.use(errorHandler);

module.exports = server;
