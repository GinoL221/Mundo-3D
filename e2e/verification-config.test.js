import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const playwrightConfig = readFileSync(new URL('./playwright.config.ts', import.meta.url), 'utf8');
const astroConfig = readFileSync(new URL('../frontend/astro.config.mjs', import.meta.url), 'utf8');

test('Playwright web servers use workspace-derived working directories', () => {
  assert.match(playwrightConfig, /const workspaceRoot = resolve\(import\.meta\.dirname, '\.\.'\)/);
  assert.match(playwrightConfig, /command: 'pnpm --filter backend start',[\s\S]*?cwd: resolve\(workspaceRoot, 'backend'\)/);
  assert.match(playwrightConfig, /command: 'pnpm --filter frontend dev --port 4322 --ignore-lock --mode development',[\s\S]*?cwd: resolve\(workspaceRoot, 'frontend'\)/);
});

test('Astro resolves root and envDir from its config file URL', () => {
  assert.match(astroConfig, /const frontendRoot = fileURLToPath\(new URL\('\.', import\.meta\.url\)\)/);
  assert.match(astroConfig, /root: frontendRoot,[\s\S]*?vite: \{ envDir: frontendRoot \}/);
});
