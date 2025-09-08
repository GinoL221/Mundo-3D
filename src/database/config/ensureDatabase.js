const mysql = require("mysql2/promise");
const config = require("./config");

/**
 * Crea la base de datos si no existe antes de inicializar Sequelize
 */
async function ensureDatabaseExists(env = "development") {
  const dbConfig = config[env];
  const dbName = dbConfig.database;
  const dbUser = dbConfig.username;
  const dbPass = dbConfig.password;
  const dbHost = dbConfig.host;

  // Conexión sin base de datos
  const connection = await mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPass,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
  await connection.end();
}

module.exports = { ensureDatabaseExists };
