const REQUIRED = [
  'JWT_SECRET',
  'CORS_ORIGIN',
  'COOKIE_SECRET',
  'DB_USER',
  'DB_PASS',
  'DB_NAME',
  'DB_HOST',
  'PUBLIC_API_URL',
];

// COOKIE_DOMAIN is optional in the app's own code (cookieOptions.ts checks
// `if (process.env.COOKIE_DOMAIN)`) — required only for a cross-subdomain
// deploy, so this preflight warns rather than hard-fails on it.
const WARN_ONLY = ['COOKIE_DOMAIN'];

function checkEnv(env = process.env) {
  return {
    missing: REQUIRED.filter((key) => !env[key]),
    warnings: WARN_ONLY.filter((key) => !env[key]),
  };
}

if (require.main === module) {
  const { missing, warnings } = checkEnv();

  if (missing.length > 0) {
    console.log(
      `[env-preflight] FAIL: ${missing.length} required production env var(s) missing: ${missing.join(', ')}`
    );
    process.exitCode = 1;
  }

  for (const key of warnings) {
    console.log(
      `[env-preflight] WARN: ${key} not set — required only for the cross-subdomain cookie topology; safe to ignore on a single-domain deploy.`
    );
  }
}

module.exports = { checkEnv, REQUIRED, WARN_ONLY };
