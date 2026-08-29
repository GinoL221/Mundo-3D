require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'mundo_3d_db',
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
  },
  test: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: 'mundo_3d_test',
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    // Managed DB (Aiven) listens on a non-standard port. Parse only when set so
    // `Number(undefined)` NaN never reaches the driver; omit the key otherwise.
    ...(process.env.DB_PORT ? { port: Number(process.env.DB_PORT) } : {}),
    dialect: 'mysql',
    // Enforce TLS with CA verification against the managed DB. The CA PEM is
    // provided verbatim via DB_CA_CERT; `rejectUnauthorized: true` is mandatory
    // (never disabled). Absent DB_CA_CERT falls back to Node's public bundle and
    // fails the handshake loudly rather than degrading silently.
    dialectOptions: {
      ssl: {
        ca: process.env.DB_CA_CERT,
        rejectUnauthorized: true,
      },
    },
  },
};
