const REQUIRED = [
  'JWT_SECRET',
  'CORS_ORIGIN',
  'COOKIE_SECRET',
  'DB_USER',
  'DB_PASS',
  'DB_NAME',
  'DB_HOST',
  'DB_PORT',
  'DB_CA_CERT',
];

// Checked but warn-only — a missing value produces a warning, never a non-zero
// exit:
//   COOKIE_DOMAIN — `cookieOptions.ts` guards it with `if (process.env.COOKIE_DOMAIN)`,
//     so it is required only for a cross-subdomain cookie deploy.
//   PUBLIC_API_URL — a frontend build-time variable enforced by
//     `frontend/astro.config.mjs`; the backend runtime never reads it, so a
//     hard-required preflight here would be stricter than the app's own contract.
const WARN_ONLY = ['COOKIE_DOMAIN', 'PUBLIC_API_URL'];

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
      `[env-preflight] WARN: ${key} not set — warn-only (COOKIE_DOMAIN applies only to the cross-subdomain cookie topology; PUBLIC_API_URL is a frontend build-time variable). Safe to ignore if it does not apply to this deploy.`
    );
  }
}

module.exports = { checkEnv, REQUIRED, WARN_ONLY };
