import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
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
      // logs in far more than the production default of 5 attempts allows.
      env: {
        NODE_ENV: 'test',
        PORT: '3032',
        CORS_ORIGIN: 'http://localhost:4322',
        JWT_SECRET: 'e2e-only-jwt-secret-not-for-production',
        COOKIE_SECRET: 'e2e-only-cookie-secret-not-for-production',
        LOGIN_LIMIT_MAX: '1000',
        REGISTER_LIMIT_MAX: '1000',
      },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter frontend dev --port 4322',
      port: 4322,
      env: { PUBLIC_API_URL: 'http://localhost:3032' },
      reuseExistingServer: !process.env.CI,
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ]
});
