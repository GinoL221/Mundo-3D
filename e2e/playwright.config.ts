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
      env: { NODE_ENV: 'test', PORT: '3032', CORS_ORIGIN: 'http://localhost:4322' },
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
