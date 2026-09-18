const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG = path.join(ROOT, 'e2e', 'playwright.config.ts');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const GLOBAL_SETUP = path.join(ROOT, 'e2e', 'global-setup.ts');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

test('Playwright uses one CI-only retry and explicit Linux visual inputs', () => {
  const config = read(CONFIG);
  assert.match(config, /retries:\s*isCi \? 1 : 0/);
  for (const input of [
    'viewport: { width: 1280, height: 720 }',
    "locale: 'es-AR'",
    "timezoneId: 'UTC'",
    "colorScheme: 'light'",
    "reducedMotion: 'reduce'",
    'deviceScaleFactor: 1',
    'hasTouch: false',
    'isMobile: false',
    "trace: isCi ? 'retain-on-failure' : 'on-first-retry'",
    "screenshot: isCi ? 'only-on-failure' : 'off'",
    "video: isCi ? 'retain-on-failure' : 'off'",
  ]) {
    assert.ok(config.includes(input), `expected CI visual or diagnostic input: ${input}`);
  }
  assert.match(config, /workers:\s*1/);
  assert.match(config, /name:\s*'chromium'/);
  assert.match(config, /port:\s*3032/);
  assert.match(config, /port:\s*4322/);
  assert.match(read(GLOBAL_SETUP), /db:test:prepare/);
});

test('the E2E workflow reports recovered passes and uploads diagnostics only after test failure', () => {
  const workflow = read(WORKFLOW);
  assert.match(workflow, /id:\s*e2e-tests/);
  assert.match(workflow, /RECOVERED_PASS/);
  assert.match(workflow, /FINAL_E2E_FAILURE/);
  assert.match(workflow, /steps\.e2e-tests\.outcome == 'failure'/);
  assert.match(workflow, /retention-days:\s*14/);
  assert.match(workflow, /e2e\/playwright-report\//);
  assert.match(workflow, /e2e\/test-results\//);
  assert.match(
    workflow,
    /Upload coverage and risk-map evidence[\s\S]*?if: always\(\)[\s\S]*?retention-days: 14/,
  );
  assert.match(workflow, /needs: \[quality, integration, e2e\]/);
  assert.doesNotMatch(workflow, /continue-on-error/);
});
