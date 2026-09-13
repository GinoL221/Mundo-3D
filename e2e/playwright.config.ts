import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup',
  use: {
    baseURL: 'http://localhost:4322',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter backend start',
      port: 3032,
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
        PORT: '3032',
        CORS_ORIGIN: 'http://localhost:4322',
        JWT_SECRET: 'e2e-only-jwt-secret-not-for-production',
        COOKIE_SECRET: 'e2e-only-cookie-secret-not-for-production',
        LOGIN_LIMIT_MAX: '1000',
        REGISTER_LIMIT_MAX: '1000',
        ACCOUNT_LOGIN_LIMIT_MAX: '1000',
        // Confirmation limits remain enabled in E2E; these raised test values
        // document the intended isolated-run configuration for the RED contracts.
        EMAIL_CONFIRMATION_ATTEMPT_LIMIT_MAX: '1000',
        RESEND_CONFIRMATION_IP_LIMIT_MAX: '1000',
        PUBLIC_APP_URL: 'http://localhost:4322',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        SMTP_SECURE: 'false',
        SMTP_FROM: 'noreply@example.test',
      },
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter frontend dev --port 4322 --ignore-lock',
      port: 4322,
      env: {
        PUBLIC_API_URL: 'http://localhost:3032',
        ASTRO_DEV_BACKGROUND: '0',
      },
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
