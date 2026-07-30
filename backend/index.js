require("dotenv").config();

// Register ts-node dynamically so TypeScript modules can be required from
// this entry point without depending on ./src/app already having done so.
if (!process.env.JEST_WORKER_ID) {
  require("ts-node/register");
}

const server = require("./src/app");
const { markReady } = require("./src/infrastructure/health/readinessState");

// Validate required environment variables
if (!process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET environment variable is required. Set it in .env file.");
  process.exit(1);
}

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

if (env === "test") {
  markReady();
  server.listen(PORT, () => {
    console.log(`El servidor de prueba esta corriendo en http://localhost:${PORT}`);
  });
} else {
  ensureDatabaseExists(env)
    .then(() => db.sequelize.authenticate())
    .then(() => checkNoPendingMigrations())
    .then(() => seedInitialData(db))
    .then(() => {
      server.listen(PORT, () => {
        markReady();
        console.log(`El servidor esta corriendo en http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error(
        "Error al conectar con la base de datos o insertar datos iniciales:",
        err
      );
      process.exit(1);
    });
}

