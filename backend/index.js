require("dotenv").config();

// Register ts-node dynamically so TypeScript modules can be required from
// this entry point without depending on ./src/app already having done so.
if (!process.env.JEST_WORKER_ID) {
  require("ts-node/register");
}

const server = require("./src/app");
const { markReady, markUnready } = require("./src/infrastructure/health/readinessState");
const { logger } = require("./src/infrastructure/logging/logger");

const {
  ensureDatabaseExists,
} = require("./src/database/config/ensureDatabase");

//variable de entorno
const PORT = process.env.PORT || 3031;

const db = require("./src/database/models/db");
const { seedInitialData } = require("./src/database/seed");
const {
  checkNoPendingMigrations,
} = require("./src/database/checkPendingMigrations");

const env = process.env.NODE_ENV || "development";

// Forced-shutdown deadline is external-orchestrator-tunable (see
// design.md's "Forced-shutdown timeout is env-configurable" decision).
// Non-finite or non-positive values fall back to the 10s default rather
// than disabling the guard.
function resolveShutdownTimeoutMs() {
  const parsed = Number(process.env.SHUTDOWN_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10000;
  }
  return parsed;
}

const SHUTDOWN_TIMEOUT_MS = resolveShutdownTimeoutMs();
// Carved out of SHUTDOWN_TIMEOUT_MS (not added to it) so the flush window
// never pushes the worst-case wall clock past the configured deadline.
const FLUSH_GRACE_MS = 250;

let httpServer = null;
let shuttingDown = false;
let bootAborted = false;

// Flushes the Pino logger before exiting. `logger.flush(cb)` is not
// guaranteed to invoke `cb` on a transport-less destination, so a fallback
// timer guarantees the process still exits.
function exitAfterFlush(code) {
  let exited = false;
  const doExit = () => {
    if (exited) return;
    exited = true;
    process.exit(code);
  };
  const fallback = setTimeout(doExit, FLUSH_GRACE_MS);
  if (typeof fallback.unref === "function") {
    fallback.unref();
  }
  logger.flush(() => {
    clearTimeout(fallback);
    doExit();
  });
}

// Idempotent, signal-driven graceful shutdown (see design.md's Data Flow
// diagram). Deliberately guarded by `shuttingDown`, not `!isReady()`: that
// would conflate "shutting down" with "not yet booted".
function shutdown(signal) {
  if (shuttingDown) {
    logger.warn({ signal }, "Shutdown already in progress, ignoring signal");
    return;
  }
  shuttingDown = true;

  if (!httpServer) {
    bootAborted = true;
    logger.error({ signal }, "Signal received before boot completed; aborting boot");
    process.exit(1);
    return;
  }

  markUnready();

  const forcedTimer = setTimeout(() => {
    httpServer.closeAllConnections();
    logger.error({ signal }, "Graceful shutdown timed out; forcing exit");
    exitAfterFlush(1);
  }, Math.max(0, SHUTDOWN_TIMEOUT_MS - FLUSH_GRACE_MS));
  if (typeof forcedTimer.unref === "function") {
    forcedTimer.unref();
  }

  httpServer.closeIdleConnections();
  httpServer.close((err) => {
    clearTimeout(forcedTimer);
    if (err) {
      logger.error({ err, signal }, "Error while closing HTTP server");
    }
    db.sequelize
      .close()
      .catch((closeErr) => {
        logger.error({ err: closeErr }, "Error while closing database connection");
      })
      .finally(() => {
        logger.info({ signal }, "Graceful shutdown complete");
        exitAfterFlush(0);
      });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

if (env === "test") {
  markReady();
  httpServer = server.listen(PORT, function onListening() {
    // Bound to the listening server via the EventEmitter's own `this`
    // (real Node behavior: `.listen()`'s callback is registered as a
    // 'listening' listener), so this works whether or not the outer
    // `httpServer =` assignment above has completed yet.
    logger.info({ port: this.address().port }, "El servidor de prueba esta corriendo");
  });
} else {
  ensureDatabaseExists(env)
    .then(() => db.sequelize.authenticate())
    .then(() => checkNoPendingMigrations())
    .then(() => seedInitialData(db))
    .then(() => {
      if (bootAborted) {
        return;
      }
      httpServer = server.listen(PORT, function onListening() {
        markReady();
        logger.info({ port: this.address().port }, "El servidor esta corriendo");
      });
    })
    .catch((err) => {
      if (bootAborted) {
        return;
      }
      logger.error(
        { err },
        "Error al conectar con la base de datos o insertar datos iniciales"
      );
      process.exit(1);
    });
}

