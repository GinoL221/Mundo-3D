const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { run } = require('./smoke-test');

// Builds a fixture server whose response for a given path is driven by a
// per-path queue of status codes (each request pops one; once exhausted, the
// last code repeats). Records the order paths were hit for ordering assertions.
function startFixtureServer(sequences) {
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url);
    const queue = sequences[req.url];
    const status = queue.length > 1 ? queue.shift() : queue[0];
    res.writeHead(status);
    res.end();
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
