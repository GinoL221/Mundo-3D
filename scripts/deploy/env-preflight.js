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
  // Cloudflare R2 (S3-compatible object storage) for admin-uploaded product/user
  // images. R2_ENDPOINT is the explicit S3 API endpoint shown on R2's token
  // screen, not derived from an account id, so switching to another
  // S3-compatible provider is a value change, not a code change.
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL_BASE',
];

// Checked but warn-only — a missing value produces a warning, never a non-zero
// exit:
//   COOKIE_DOMAIN — `cookieOptions.ts` guards it with `if (process.env.COOKIE_DOMAIN)`,
//     so it is required only for a cross-subdomain cookie deploy.
//   PUBLIC_API_URL — a frontend build-time variable enforced by
//     `frontend/astro.config.mjs`; the backend runtime never reads it, so a
//     hard-required preflight here would be stricter than the app's own contract.
const WARN_ONLY = ['COOKIE_DOMAIN', 'PUBLIC_API_URL'];

// NODE_ENV is checked by VALUE, not by presence, so it is not part of REQUIRED.
// `test` makes JwtSecret.ts/CookieSecret.ts fall back to constants committed in
// this repository and disables both rate limiters, so a production process
// running with it would sign forgeable tokens, unthrottled. Anything other than
// `production` is refused rather than only warned about: there is no legitimate
// reason for a deploy to run under another value.
function checkNodeEnv(env) {
  if (env.NODE_ENV === 'production') return null;
  const actual = env.NODE_ENV ? `"${env.NODE_ENV}"` : 'unset';
  return `NODE_ENV must be "production" for a deploy, but it is ${actual}.`;
}

function checkEnv(env = process.env) {
  return {
    missing: REQUIRED.filter((key) => !env[key]),
    warnings: WARN_ONLY.filter((key) => !env[key]),
    nodeEnv: checkNodeEnv(env),
  };
}

if (require.main === module) {
  const { missing, warnings, nodeEnv } = checkEnv();

  if (nodeEnv) {
    console.log(
      `[env-preflight] FAIL: ${nodeEnv} Running a deploy with NODE_ENV=test falls back to secrets committed in this repository and disables the login/register rate limiters.`
    );
    process.exitCode = 1;
  }

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
