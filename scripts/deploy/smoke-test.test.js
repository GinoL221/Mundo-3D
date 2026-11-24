const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { execFile, spawnSync } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const { run, DEFAULT_TIMEOUT_MS } = require('./smoke-test');

const SMOKE_SCRIPT = path.join(__dirname, 'smoke-test.js');

// Builds a fixture server whose response for a given path is driven by a
// per-path queue of status codes or `{ status, body }` entries (each request
// pops one; once exhausted, the last entry repeats). Records the order paths
// were hit for ordering assertions.
function startFixtureServer(sequences) {
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url);
    const queue = sequences[req.url];
    const entry = queue.length > 1 ? queue.shift() : queue[0];
    if (typeof entry === 'object' && entry !== null) {
      res.writeHead(entry.status, { 'Content-Type': 'application/json' });
      res.end(entry.body ?? '');
    } else {
      res.writeHead(entry);
      res.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, hits, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

test('both endpoints healthy immediately -> resolves well before timeout', async () => {
  const { server, baseUrl } = await startFixtureServer({
    '/health/live': [200],
    '/health/ready': [200],
  });
  try {
    const start = Date.now();
    const result = await run({ baseUrl, timeoutMs: 5000 });
    const elapsed = Date.now() - start;
    assert.equal(result.ok, true);
    assert.ok(elapsed < 2000, `expected a fast resolve, took ${elapsed}ms`);
  } finally {
    server.close();
  }
});

test('/health/ready never returns 200 -> fails only after the timeout elapses', async () => {
  const { server, baseUrl } = await startFixtureServer({
    '/health/live': [200],
    '/health/ready': [503],
  });
  try {
    const start = Date.now();
    const result = await run({ baseUrl, timeoutMs: 1500 });
    const elapsed = Date.now() - start;
    assert.equal(result.ok, false);
    assert.ok(elapsed >= 1500, `expected to wait out the timeout, took ${elapsed}ms`);
  } finally {
    server.close();
  }
});

test('waits for liveness before ever checking readiness', async () => {
  const { server, hits, baseUrl } = await startFixtureServer({
    '/health/live': [503, 503, 200],
    '/health/ready': [200],
  });
  try {
    await run({ baseUrl, timeoutMs: 5000 });
    const firstReadyIndex = hits.indexOf('/health/ready');
    const firstLive200Index = hits.lastIndexOf('/health/live', firstReadyIndex === -1 ? hits.length : firstReadyIndex);
    assert.ok(firstReadyIndex > 0, 'expected /health/ready to have been polled');
    assert.ok(
      hits.slice(0, firstReadyIndex).every((path) => path === '/health/live'),
      `expected only /health/live hits before the first /health/ready hit, got ${JSON.stringify(hits)}`
    );
  } finally {
    server.close();
  }
});

test('base URL refuses connections -> fails without throwing', async () => {
  const result = await run({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 1000 });
  assert.equal(result.ok, false);
});

test('DEFAULT_TIMEOUT_MS is 120000ms for Render Free cold-start wake-up', () => {
  assert.equal(DEFAULT_TIMEOUT_MS, 120000);
});

test('expectDemoEnabled unset or empty -> skips /api/demo/status completely', async () => {
  const { server, hits, baseUrl } = await startFixtureServer({
    '/health/live': [200],
    '/health/ready': [200],
  });
  try {
    const resUnset = await run({ baseUrl, timeoutMs: 2000 });
    const resEmpty = await run({ baseUrl, timeoutMs: 2000, expectDemoEnabled: '' });
    assert.equal(resUnset.ok, true);
    assert.equal(resEmpty.ok, true);
    assert.ok(!hits.includes('/api/demo/status'), `unexpected /api/demo/status hit: ${JSON.stringify(hits)}`);
  } finally {
    server.close();
  }
});

test('expectDemoEnabled="true" -> passes on 200 { enabled: true }', async () => {
  const { server, hits, baseUrl } = await startFixtureServer({
    '/health/live': [200],
    '/health/ready': [200],
    '/api/demo/status': [{ status: 200, body: JSON.stringify({ enabled: true }) }],
  });
  try {
    const result = await run({ baseUrl, timeoutMs: 2000, expectDemoEnabled: 'true' });
    assert.equal(result.ok, true);
    assert.ok(hits.includes('/api/demo/status'));
  } finally {
    server.close();
  }
});

test('expectDemoEnabled="true" -> fails on 404 or { enabled: false }', async () => {
  const srv404 = await startFixtureServer({
    '/health/live': [200],
    '/health/ready': [200],
    '/api/demo/status': [404],
  });
  const srvFalse = await startFixtureServer({
    '/health/live': [200],
    '/health/ready': [200],
    '/api/demo/status': [{ status: 200, body: JSON.stringify({ enabled: false }) }],
  });
  try {
    const res404 = await run({ baseUrl: srv404.baseUrl, timeoutMs: 2000, expectDemoEnabled: 'true' });
    assert.equal(res404.ok, false);
    assert.equal(res404.phase, 'demo');

    const resFalse = await run({ baseUrl: srvFalse.baseUrl, timeoutMs: 2000, expectDemoEnabled: 'true' });
    assert.equal(resFalse.ok, false);
    assert.equal(resFalse.phase, 'demo');
  } finally {
    srv404.server.close();
    srvFalse.server.close();
  }
});

test('expectDemoEnabled="false" -> passes on 404 and fails on 200', async () => {
  const srv404 = await startFixtureServer({
    '/health/live': [200],
    '/health/ready': [200],
    '/api/demo/status': [404],
  });
  const srv200 = await startFixtureServer({
    '/health/live': [200],
    '/health/ready': [200],
    '/api/demo/status': [{ status: 200, body: JSON.stringify({ enabled: true }) }],
  });
  try {
    const res404 = await run({ baseUrl: srv404.baseUrl, timeoutMs: 2000, expectDemoEnabled: 'false' });
    assert.equal(res404.ok, true);

    const res200 = await run({ baseUrl: srv200.baseUrl, timeoutMs: 2000, expectDemoEnabled: 'false' });
    assert.equal(res200.ok, false);
    assert.equal(res200.phase, 'demo');
  } finally {
    srv404.server.close();
    srv200.server.close();
  }
});

test('invalid SMOKE_EXPECT_DEMO_ENABLED -> fails fast in run() and exits non-zero via CLI', async () => {
  const result = await run({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 5000, expectDemoEnabled: 'yes' });
  assert.equal(result.ok, false);
  assert.equal(result.phase, 'config');
  assert.match(result.lastError.message, /SMOKE_EXPECT_DEMO_ENABLED/);

  const cli = spawnSync(process.execPath, [SMOKE_SCRIPT, 'http://127.0.0.1:1'], {
    env: { ...process.env, SMOKE_EXPECT_DEMO_ENABLED: 'invalid' },
    encoding: 'utf8',
  });
  assert.notEqual(cli.status, 0);
  assert.match(cli.stdout, /SMOKE_EXPECT_DEMO_ENABLED/);
});

test('CLI preserves baseline success output when SMOKE_EXPECT_DEMO_ENABLED is unset', async () => {
  const { server, baseUrl } = await startFixtureServer({ '/health/live': [200], '/health/ready': [200] });
  try {
    const env = { ...process.env };
    delete env.SMOKE_EXPECT_DEMO_ENABLED;
    const { stdout } = await execFileAsync(process.execPath, [SMOKE_SCRIPT, baseUrl], { env });
    assert.match(stdout, /^\[smoke-test\] OK: \/health\/live and \/health\/ready both returned 200 after \d+ms\n$/);
  } finally {
    server.close();
  }
});
