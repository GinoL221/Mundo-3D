import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const appOrigin = 'http://127.0.0.1:4323';
const frontendDirectory = fileURLToPath(new URL('../frontend/', import.meta.url));

export default defineConfig({
  testDir: './tests',
  testMatch: 'commission-intake.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: appOrigin,
    trace: 'off',
  },
  webServer: {
    command: './node_modules/.bin/astro dev --host 127.0.0.1 --port 4323',
    cwd: frontendDirectory,
    url: appOrigin,
    timeout: 60_000,
    reuseExistingServer: false,
    env: {
      PUBLIC_API_URL: 'http://commission-e2e.invalid',
      ASTRO_DEV_BACKGROUND: '0',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
