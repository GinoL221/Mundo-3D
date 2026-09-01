if (process.env.NODE_ENV !== 'test') {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required but not set in environment.');
  }
}

// Fail loud, not open: without this, a production boot with no CORS_ORIGIN
// silently falls back to the localhost dev defaults below, which denies
// every real origin instead of alerting anyone to the misconfiguration.
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  throw new Error('CORS_ORIGIN is required but not set in production environment.');
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// Register ts-node dynamically to require TypeScript modules in JavaScript.
// Never when compiled (RUN_COMPILED=true, set by index.js's caller): `pnpm
// build` compiles this file into dist/app.js, and a production install
// prunes ts-node (a devDependency) — this line must never execute there, or
// it MODULE_NOT_FOUNDs on boot. Deliberately not keyed on NODE_ENV — see
// index.js's RUN_COMPILED comment.
if (!process.env.JEST_WORKER_ID && process.env.RUN_COMPILED !== 'true') {
  require('ts-node/register');
}

const requestIdMiddleware = require('./infrastructure/middlewares/requestId').default;
const requestLoggerMiddleware = require('./infrastructure/middlewares/requestLogger').default;
const apiRouter = require('./infrastructure/routes/api/index').default;
const healthRouter = require('./infrastructure/routes/health').default;

const server = express();

// Render terminates TLS at exactly one edge proxy hop in front of this
// service. Trust precisely that one hop (not `true`, which is permissive
// and trips express-rate-limit's ERR_ERL_PERMISSIVE_TRUST_PROXY guard): the
// real client address is then taken from the first X-Forwarded-For entry, so
// req.ip — and the login/register rate-limit keys derived from it, plus the
// request logger — reflect the actual client and a client-supplied
// X-Forwarded-For cannot spoof it. Must be set before the limiter mounts.
server.set('trust proxy', 1);

const errorHandler = require('./infrastructure/middlewares/errorHandler').default;

// 0. Request correlation ID
server.use(requestIdMiddleware);

// 1. Security headers (first). Explicit CSP, stricter than helmet's
// defaults (which allow 'unsafe-inline' styles and any https: font source):
// this API serves no HTML document today (no view engine, no .ejs, no
// res.render — see design.md), only JSON, health checks, and static assets
// (public/images, public/img) — default-src 'none' denies everything not
// explicitly allowed below, so a future HTML route starts locked down
// instead of inheriting a permissive default.
server.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        imgSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }),
);

// 1.5 Health checks (path-prefixed only — never a global gate; must not spam
// request logs or go through body parsing)
server.use('/health', healthRouter);

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
server.use(requestLoggerMiddleware);

// 5. Body parsing
server.use(express.urlencoded({ extended: false }));
server.use(express.json());

// 5.5 Cookie parsing (unsigned — nothing uses signed cookies; needed before
// /api so apiAuthMiddleware/csrfGuard can read req.cookies)
server.use(cookieParser());

// API routes (mounted at /api)
server.use('/api', apiRouter);

// Ruta 404
server.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler (must be last)
server.use(errorHandler);

module.exports = server;
