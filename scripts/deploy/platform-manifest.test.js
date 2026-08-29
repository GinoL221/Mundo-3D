const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RENDER_YAML = path.join(REPO_ROOT, 'render.yaml');
const RUNBOOKS = path.join(REPO_ROOT, 'docs', 'RUNBOOKS.md');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

// Secrets that must be declared as dashboard-set keys, never with a value in git.
const SYNC_FALSE_SECRETS = [
  'JWT_SECRET',
  'COOKIE_SECRET',
  'DB_USER',
  'DB_PASS',
  'DB_NAME',
  'DB_HOST',
  'DB_PORT',
  'DB_CA_CERT',
  'CORS_ORIGIN',
  'COOKIE_DOMAIN',
];

test('render.yaml exists at the repository root', () => {
  assert.ok(fs.existsSync(RENDER_YAML), 'expected render.yaml at the repo root');
});

test('render.yaml is tab-free and declares a single web service', () => {
  const text = read(RENDER_YAML);
  assert.ok(!text.includes('\t'), 'YAML must be indented with spaces, not tabs');
  assert.match(text, /^services:/m);
  const webServices = text.match(/^\s*-\s+type:\s*web\b/gm) || [];
  assert.equal(webServices.length, 1, 'expected exactly one web service');
});

test('render.yaml pins the build, start, health check, and Node runtime', () => {
  const text = read(RENDER_YAML);
  assert.match(text, /buildCommand:.*pnpm --filter backend build/);
  assert.match(text, /startCommand:\s*pnpm --filter backend deploy:start\s*$/m);
  assert.match(text, /healthCheckPath:\s*\/health\/ready\s*$/m);
});

test('render.yaml sets the non-secret runtime env inline', () => {
  const text = read(RENDER_YAML);
  assert.match(text, /- key:\s*NODE_ENV\n\s+value:\s*production/);
  assert.match(text, /- key:\s*RUN_COMPILED\n\s+value:\s*["']?true["']?/);
  assert.match(text, /- key:\s*NODE_VERSION\n\s+value:\s*["']?22["']?/);
});

test('render.yaml declares every secret as a sync:false key with no inline value', () => {
  const text = read(RENDER_YAML);
  for (const secret of SYNC_FALSE_SECRETS) {
    const block = new RegExp(`- key:\\s*${secret}\\n\\s+sync:\\s*false`);
    assert.match(text, block, `${secret} must be declared as "sync: false"`);
    const withValue = new RegExp(`- key:\\s*${secret}\\n\\s+value:`);
    assert.doesNotMatch(text, withValue, `${secret} must not carry an inline value`);
  }
});

test('render.yaml contains no secret material or sync:true entries', () => {
  const text = read(RENDER_YAML);
  assert.doesNotMatch(text, /BEGIN [A-Z ]*(PRIVATE KEY|CERTIFICATE)/);
  assert.doesNotMatch(text, /sync:\s*true/);
});

test('RUNBOOKS.md has a platform bring-up section covering Render, Aiven, and Vercel', () => {
  const text = read(RUNBOOKS);
  assert.match(text, /^##\s+.*(Platform bring-up|Platform Bring-Up)/m);
  for (const provider of ['Aiven', 'Render', 'Vercel']) {
    assert.ok(text.includes(provider), `runbook platform section must mention ${provider}`);
  }
});

test('RUNBOOKS.md platform section documents the domain, cookie, TLS, and cold-start wiring', () => {
  const text = read(RUNBOOKS);
  for (const token of [
    'DB_CA_CERT',
    'DB_PORT',
    'COOKIE_DOMAIN',
    'CORS_ORIGIN',
    'PUBLIC_API_URL',
    'SMOKE_TEST_TIMEOUT_MS',
    'api.',
  ]) {
    assert.ok(text.includes(token), `runbook platform section must mention ${token}`);
  }
});

test('RUNBOOKS.md keeps the pre-existing Deploy Pipeline section', () => {
  const text = read(RUNBOOKS);
  assert.match(text, /^##\s+Deploy Pipeline/m);
});
