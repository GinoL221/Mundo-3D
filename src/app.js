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

const userLoggedMiddleware = require('./middlewares/userLogged');
const errorHandler = require('./middlewares/errorHandler.js');
const { csrfProtection } = require('./middlewares/csrf.js');

//configuración de session
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

server.use(userLoggedMiddleware);

server.use(cookies());
server.use(morgan('dev'));
server.set('view engine', 'ejs');

//manejar data desde un formulario HTML
server.use(express.urlencoded({ extended: false }));
server.use(express.json());

//Reconoce put o delete
server.use(methodOverride('_method'));

server.use(express.static(path.join(__dirname, '../public')));

server.use(cors());

// Security headers
server.use(helmet());

// CSRF protection (must be after session + cookie-parser + body parser)
server.use(csrfProtection);

// API routes (mounted at /api)
server.use('/api', apiRouter);

server.use(mainRoutes);
server.use(userRoutes);
server.use(productsRoutes);

//Ruta 404
server.use((req, res, next) => {
  const ruta = path.join(__dirname, './views/404NotFound.ejs');
  res.status(404).render(ruta, { message: 'Dirección no encontrada' });
});

// Global error handler (must be last)
server.use(errorHandler);

module.exports = server;
