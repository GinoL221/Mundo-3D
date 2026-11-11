import { defineConfig, devices } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readE2EDatabaseContext } = require('../backend/src/database/e2e/context.js');
readE2EDatabaseContext(process.env, { required: true });
function requiredPort(name: string): number {
  const value = process.env[name] ?? '';
  if (!/^[1-9][0-9]{0,4}$/.test(value) || String(Number(value)) !== value || Number(value) > 65535) {
    throw new Error('E2E requires supervised endpoints; use pnpm test:e2e or pnpm --filter e2e test:ui/test:debug');
  }
  return Number(value);
}
const backendPort = requiredPort('M3D_E2E_BACKEND_PORT');
const frontendPort = requiredPort('M3D_E2E_FRONTEND_PORT');
const smtpPort = requiredPort('SMTP_PORT');
requiredPort('M3D_E2E_MAILPIT_HTTP_PORT');
const frontendOrigin = `http://localhost:${frontendPort}`;
const backendOrigin = `http://localhost:${backendPort}`;
const isCi = Boolean(process.env.CI);

const ciVisualUse = isCi
  ? {
      viewport: { width: 1280, height: 720 },
      locale: 'es-AR',
      timezoneId: 'UTC',
      colorScheme: 'light' as const,
      reducedMotion: 'reduce' as const,
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
    }
  : {};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: isCi ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  globalSetup: './global-setup',
  use: {
    baseURL: frontendOrigin,
    trace: isCi ? 'retain-on-failure' : 'on-first-retry',
    screenshot: isCi ? 'only-on-failure' : 'off',
    video: isCi ? 'retain-on-failure' : 'off',
  },
  webServer: [
    {
      command: 'pnpm --filter backend start',
      port: backendPort,
      // This is a real server process, not a Jest worker, so it no longer
      // inherits the committed test secrets or the rate-limiter bypass — both
      // are now gated on JEST_WORKER_ID so a misconfigured deploy can never
      // reach them. The values below are throwaway fixtures for this suite
      // only; the limits are raised rather than disabled because the suite
      // logs in far more than the production defaults allow. A fresh backend
      // is required for each run so its in-memory limiter state cannot leak
      // into a repeated focused execution.
      //
      // EVERY limiter needs raising here, including any added later. The
      // per-account limiter caps failed attempts per EMAIL; a fresh process
      // keeps the failed-login assertion tied to its intended wrong-password
      // path instead of a stale rate-limit response.
      env: {
        NODE_ENV: 'test',
        PORT: String(backendPort),
        CORS_ORIGIN: frontendOrigin,
        JWT_SECRET: 'e2e-only-jwt-secret-not-for-production',
        COOKIE_SECRET: 'e2e-only-cookie-secret-not-for-production',
        LOGIN_LIMIT_MAX: '1000',
        REGISTER_LIMIT_MAX: '1000',
        ACCOUNT_LOGIN_LIMIT_MAX: '1000',
        REVOKE_REFRESH_LIMIT_MAX: '1000',
        REFRESH_LIMIT_MAX: '1000',
        // Confirmation limits remain enabled in E2E; these raised test values
        // document the intended isolated-run configuration for the RED contracts.
        EMAIL_CONFIRMATION_ATTEMPT_LIMIT_MAX: '1000',
        RESEND_CONFIRMATION_IP_LIMIT_MAX: '1000',
        PUBLIC_APP_URL: frontendOrigin,
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String(smtpPort),
        // Neutralize operator SMTP credentials: this Mailpit instance has no auth.
        SMTP_USER: '',
        SMTP_PASS: '',
        SMTP_SECURE: 'false',
        SMTP_FROM: 'noreply@example.test',
        ...(process.env.DB_HOST ? { DB_HOST: process.env.DB_HOST } : {}),
        ...(process.env.DB_PORT ? { DB_PORT: process.env.DB_PORT } : {}),
        ...(process.env.M3D_E2E_RUN_ID ? { M3D_E2E_RUN_ID: process.env.M3D_E2E_RUN_ID } : {}),
        ...(process.env.M3D_E2E_EXPECTED_SERVER_UUID
          ? { M3D_E2E_EXPECTED_SERVER_UUID: process.env.M3D_E2E_EXPECTED_SERVER_UUID }
          : {}),
      },
      reuseExistingServer: false,
    },
    {
      command: `pnpm --filter frontend dev --port ${frontendPort} --ignore-lock`,
      port: frontendPort,
      env: {
        PUBLIC_API_URL: backendOrigin,
        ASTRO_DEV_BACKGROUND: '0',
      },
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...ciVisualUse },
    },
  ],
});
