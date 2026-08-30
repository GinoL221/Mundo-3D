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
    // Enforce TLS with CA verification against the managed DB, but only when a
    // CA is actually supplied — env-preflight requires DB_CA_CERT before the
    // app is allowed to start in production, so this stays declarative rather
    // than forcing a TLS attempt (with no CA to verify against) in every
    // production-mode invocation, including ones that intentionally run
    // against a plain, non-managed MySQL (e.g. this repo's own CI integration
    // suite). `rejectUnauthorized: false` must never appear here.
    ...(process.env.DB_CA_CERT
      ? {
          dialectOptions: {
            ssl: {
              ca: process.env.DB_CA_CERT,
              rejectUnauthorized: true,
            },
          },
        }
      : {}),
  },
};
