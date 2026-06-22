if (process.env.NODE_ENV !== 'test') {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required but not set in environment.');
  }
}

const express = require('express');
const morgan = require('morgan');
const methodOverride = require('method-override');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

// Register ts-node dynamically to require TypeScript modules in JavaScript
if (process.env.NODE_ENV !== 'test') {
  require('ts-node/register');
}

const apiRouter = require('./infrastructure/routes/api/index').default;

const server = express();



const errorHandler = require('./infrastructure/middlewares/errorHandler').default;

// 1. Security headers (first)
server.use(helmet());

// 2. CORS headers
server.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      const allowedOrigin = process.env.CORS_ORIGIN;
      if (allowedOrigin) {
        if (origin === allowedOrigin) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      } else {
        const defaults = ['http://localhost:4321', 'http://localhost:3000'];
        if (defaults.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      }
    },
    credentials: true,
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

// API routes (mounted at /api)
server.use('/api', apiRouter);

// Ruta 404
server.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler (must be last)
server.use(errorHandler);

module.exports = server;
