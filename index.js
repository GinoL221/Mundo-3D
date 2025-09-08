const server = require("./src/app");
require("dotenv").config();
const {
  ensureDatabaseExists,
} = require("./src/database/config/ensureDatabase");

//variable de entorno
const PORT = process.env.PORT || 3031;

const { seedInitialData } = require("./src/database/seed");

// Crear la base de datos si no existe y luego iniciar el servidor
const db = require("./src/database/models/db");

ensureDatabaseExists("development")
  .then(() => db.sequelize.sync())
  .then(() => seedInitialData(db))
  .then(() => {
    server.listen(PORT, () => {
      console.log(`El servidor esta corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(
      "Error al crear la base de datos, sincronizar modelos o insertar datos iniciales:",
      err
    );
    process.exit(1);
  });
