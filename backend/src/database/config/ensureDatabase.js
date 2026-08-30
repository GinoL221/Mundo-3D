const mysql = require('mysql2/promise');
const config = require('./config');

/**
 * Crea la base de datos si no existe antes de inicializar Sequelize
 */
async function ensureDatabaseExists(env = 'development') {
  const dbConfig = config[env];
  if (!dbConfig) {
    const supportedEnvs = Object.keys(config).join(', ');
    throw new Error(`Unsupported NODE_ENV: '${env}' — expected one of: ${supportedEnvs}`);
  }

  // Production uses a managed database (Aiven) that is pre-provisioned; the
  // scoped runtime user has no CREATE DATABASE privilege. Skip this step
  // entirely — `sequelize.authenticate()` later in the boot chain still
  // fails the process closed on any genuine connectivity/auth error.
  if (env === 'production') {
    return;
  }

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
