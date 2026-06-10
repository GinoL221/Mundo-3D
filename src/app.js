const express = require('express');
const morgan = require('morgan');
const methodOverride = require('method-override');
const helmet = require('helmet');

const session = require('express-session');
const cors = require('cors');

// Agregar cors al middleware
const path = require('path');

const mainRoutes = require('./routes/mainRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const productsRoutes = require('./routes/productsRoutes.js');
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
server.use(cors());

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
server.use(cookies());

// 8. Session management
server.use(
  session({
    secret: process.env.SESSION_SECRET,
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
