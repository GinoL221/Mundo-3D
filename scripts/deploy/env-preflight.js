const BASE_REQUIRED = [
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

// Cloudflare R2 (S3-compatible object storage) for admin-uploaded product/user
// images. R2_ENDPOINT is the explicit S3 API endpoint shown on R2's token
// screen, not derived from an account id, so switching to another
// S3-compatible provider is a value change, not a code change.
const R2_REQUIRED = [
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL_BASE',
];

const CLOUDINARY_REQUIRED = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const STORAGE_REQUIRED_BY_DRIVER = {
  r2: R2_REQUIRED,
  cloudinary: CLOUDINARY_REQUIRED,
  disabled: [],
};

// Default required list (backward-compatible export for R2).
const REQUIRED = [...BASE_REQUIRED, ...R2_REQUIRED];

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

function resolveStorageDriver(env) {
  const raw = (env.STORAGE_DRIVER ?? '').trim().toLowerCase();
  const driver = raw || 'r2';
  if (!Object.prototype.hasOwnProperty.call(STORAGE_REQUIRED_BY_DRIVER, driver)) {
    return {
      driver: null,
      error: `Invalid STORAGE_DRIVER "${env.STORAGE_DRIVER.trim()}". Expected one of: r2, cloudinary, disabled.`,
    };
  }
  return { driver, error: null };
}

const DEMO_SANDBOX_REQUIRED = ['DEMO_SANDBOX_JWT_SECRET', 'DEMO_SANDBOX_SLOTS_JSON'];
const DEMO_SANDBOX_MIN_SLOTS = 3;
const DEMO_SANDBOX_MAX_SLOTS = 5;
const DEMO_SANDBOX_MIN_JWT_SECRET_LENGTH = 32;
const SYSTEM_DATABASES = new Set(['mysql', 'information_schema', 'performance_schema', 'sys']);

function isSqlIdentifier(value, maxLength) {
  return typeof value === 'string' && value.length <= maxLength && /^[a-zA-Z0-9_]+$/.test(value);
}

function validateSandboxSlotsJson(raw, controlPlaneDb, controlPlaneUser) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'DEMO_SANDBOX_SLOTS_JSON must be valid JSON.';
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length < DEMO_SANDBOX_MIN_SLOTS ||
    parsed.length > DEMO_SANDBOX_MAX_SLOTS
  ) {
    return `DEMO_SANDBOX_SLOTS_JSON must contain between ${DEMO_SANDBOX_MIN_SLOTS} and ${DEMO_SANDBOX_MAX_SLOTS} slots.`;
  }
  const slotIds = new Set();
  const databases = new Set();
  const usernames = new Set();
  const controlLower = (controlPlaneDb || '').trim().toLowerCase();
  const controlUserLower = (controlPlaneUser || '').trim().toLowerCase();
  for (const slot of parsed) {
    if (
      !slot ||
      typeof slot !== 'object' ||
      Array.isArray(slot) ||
      typeof slot.slotId !== 'string' ||
      !slot.slotId.trim() ||
      slot.slotId !== slot.slotId.trim() ||
      !isSqlIdentifier(slot.database, 64) ||
      !isSqlIdentifier(slot.username, 32) ||
      typeof slot.password !== 'string' ||
      slot.password.length === 0
    ) {
      return 'DEMO_SANDBOX_SLOTS_JSON contains an invalid slot definition.';
    }
    const dbLower = slot.database.toLowerCase();
    const userLower = slot.username.toLowerCase();
    if (
      slotIds.has(slot.slotId) ||
      databases.has(dbLower) ||
      usernames.has(userLower) ||
      dbLower === controlLower ||
      (controlUserLower && userLower === controlUserLower) ||
      SYSTEM_DATABASES.has(dbLower) ||
      userLower === 'root'
    ) {
      return 'DEMO_SANDBOX_SLOTS_JSON contains colliding, root, or reserved database/account values.';
    }
    slotIds.add(slot.slotId);
    databases.add(dbLower);
    usernames.add(userLower);
  }
  return null;
}

function checkDemoSandbox(env) {
  const flag = env.DEMO_SANDBOX_ENABLED;
  if (flag === undefined || flag === '' || flag === 'false') {
    return { enabled: false, error: null };
  }
  if (flag !== 'true') {
    return {
      enabled: false,
      error: `Invalid DEMO_SANDBOX_ENABLED "${flag}". Expected "true" or "false".`,
    };
  }
  const recover = env.DEMO_SANDBOX_RECOVER_ON_BOOT;
  if (recover !== undefined && recover !== '' && recover !== 'true' && recover !== 'false') {
    return {
      enabled: true,
      error: `Invalid DEMO_SANDBOX_RECOVER_ON_BOOT "${recover}". Expected "true" or "false".`,
    };
  }
  const effectiveHost = (env.DEMO_SANDBOX_DB_HOST || env.DB_HOST || '').trim();
  if ((env.DEMO_SANDBOX_DB_HOST || env.DB_HOST) && !/^[a-zA-Z0-9.:-]+$/.test(effectiveHost)) {
    return {
      enabled: true,
      error: 'DEMO_SANDBOX_DB_HOST (or fallback DB_HOST) must be a valid hostname or IP.',
    };
  }
  const effectivePort = (env.DEMO_SANDBOX_DB_PORT || env.DB_PORT || '').trim();
  if (env.DEMO_SANDBOX_DB_PORT || env.DB_PORT) {
    const port = Number(effectivePort);
    if (!/^\d+$/.test(effectivePort) || port < 1 || port > 65535) {
      return {
        enabled: true,
        error: 'DEMO_SANDBOX_DB_PORT (or fallback DB_PORT) must be an integer between 1 and 65535.',
      };
    }
  }
  if (env.DB_NAME && !isSqlIdentifier(env.DB_NAME.trim(), 64)) {
    return {
      enabled: true,
      error: 'DB_NAME must be a valid SQL identifier when demo sandbox is enabled.',
    };
  }
  const effectiveCa =
    env.DEMO_SANDBOX_DB_CA_CERT !== undefined && env.DEMO_SANDBOX_DB_CA_CERT !== ''
      ? env.DEMO_SANDBOX_DB_CA_CERT
      : env.DB_CA_CERT;
  if (effectiveCa !== undefined && effectiveCa !== '' && !effectiveCa.trim()) {
    return {
      enabled: true,
      error: 'DEMO_SANDBOX_DB_CA_CERT (or fallback DB_CA_CERT) cannot be blank.',
    };
  }
  if (env.DEMO_SANDBOX_JWT_SECRET && !env.DEMO_SANDBOX_JWT_SECRET.trim()) {
    return { enabled: true, error: 'DEMO_SANDBOX_JWT_SECRET cannot be blank.' };
  }
  if (
    env.DEMO_SANDBOX_JWT_SECRET &&
    env.DEMO_SANDBOX_JWT_SECRET.trim().length < DEMO_SANDBOX_MIN_JWT_SECRET_LENGTH
  ) {
    return {
      enabled: true,
      error: `DEMO_SANDBOX_JWT_SECRET must be at least ${DEMO_SANDBOX_MIN_JWT_SECRET_LENGTH} characters long.`,
    };
  }
  if (
    env.DEMO_SANDBOX_JWT_SECRET &&
    env.JWT_SECRET &&
    (env.DEMO_SANDBOX_JWT_SECRET === env.JWT_SECRET ||
      env.DEMO_SANDBOX_JWT_SECRET.trim() === env.JWT_SECRET.trim())
  ) {
    return { enabled: true, error: 'DEMO_SANDBOX_JWT_SECRET must differ from JWT_SECRET.' };
  }
  if (env.DEMO_SANDBOX_SLOTS_JSON) {
    const slotError = validateSandboxSlotsJson(
      env.DEMO_SANDBOX_SLOTS_JSON,
      env.DB_NAME,
      env.DB_USER,
    );
    if (slotError) return { enabled: true, error: slotError };
  }
  return { enabled: true, error: null };
}

function checkEnv(env = process.env) {
  const { driver, error: storageDriver } = resolveStorageDriver(env);
  const demoSandboxCheck = checkDemoSandbox(env);
  const storageRequired = driver ? STORAGE_REQUIRED_BY_DRIVER[driver] : [];
  const sandboxRequired = demoSandboxCheck.enabled ? DEMO_SANDBOX_REQUIRED : [];
  const required = [...BASE_REQUIRED, ...storageRequired, ...sandboxRequired];

  return {
    missing: required.filter((key) => !env[key]),
    warnings: WARN_ONLY.filter((key) => !env[key]),
    nodeEnv: checkNodeEnv(env),
    storageDriver,
    demoSandbox: demoSandboxCheck.error,
  };
}

if (require.main === module) {
  const { missing, warnings, nodeEnv, storageDriver, demoSandbox } = checkEnv();

  if (nodeEnv) {
    console.log(
      `[env-preflight] FAIL: ${nodeEnv} Running a deploy with NODE_ENV=test falls back to secrets committed in this repository and disables the login/register rate limiters.`,
    );
    process.exitCode = 1;
  }

  if (storageDriver) {
    console.log(`[env-preflight] FAIL: ${storageDriver}`);
    process.exitCode = 1;
  }

  if (demoSandbox) {
    console.log(`[env-preflight] FAIL: ${demoSandbox}`);
    process.exitCode = 1;
  }

  if (missing.length > 0) {
    console.log(
      `[env-preflight] FAIL: ${missing.length} required production env var(s) missing: ${missing.join(', ')}`,
    );
    process.exitCode = 1;
  }

  for (const key of warnings) {
    console.log(
      `[env-preflight] WARN: ${key} not set — warn-only (COOKIE_DOMAIN applies only to the cross-subdomain cookie topology; PUBLIC_API_URL is a frontend build-time variable). Safe to ignore if it does not apply to this deploy.`,
    );
  }
}

module.exports = { checkEnv, BASE_REQUIRED, REQUIRED, WARN_ONLY };
