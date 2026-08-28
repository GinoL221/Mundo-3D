const http = require('node:http');
const https = require('node:https');

const POLL_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 60000;

function get(url) {
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve) => {
    const req = client.get(url, (res) => {
      res.resume(); // drain, we only care about the status code
      resolve({ status: res.statusCode });
    });
    // Connection refused, DNS failure, etc. — treated as a failed attempt,
    // not a thrown exception, so polling continues until the deadline.
    req.on('error', (error) => resolve({ status: null, error }));
  });
}

// Polls `path` until it returns 200 or `deadline` (Date.now()-based) passes.
// Returns { ok, lastStatus, lastError } — never throws.
async function pollUntilHealthy(baseUrl, path, deadline) {
  let lastStatus = null;
  let lastError = null;
  while (Date.now() < deadline) {
    const { status, error } = await get(`${baseUrl}${path}`);
    lastStatus = status;
    lastError = error;
    if (status === 200) return { ok: true, lastStatus, lastError };
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return { ok: false, lastStatus, lastError };
}

// Polls GET {baseUrl}/health/live then, once live, GET {baseUrl}/health/ready
// — readiness is only ever checked after liveness has succeeded at least
// once. Both phases share one overall timeoutMs budget. Never throws.
async function run({ baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const start = Date.now();
  const deadline = start + timeoutMs;

  const live = await pollUntilHealthy(baseUrl, '/health/live', deadline);
  if (!live.ok) {
    return { ok: false, phase: 'live', lastStatus: live.lastStatus, lastError: live.lastError, elapsedMs: Date.now() - start };
  }

  const ready = await pollUntilHealthy(baseUrl, '/health/ready', deadline);
  return {
    ok: ready.ok,
    phase: ready.ok ? null : 'ready',
    lastStatus: ready.lastStatus,
    lastError: ready.lastError,
    elapsedMs: Date.now() - start,
  };
}

if (require.main === module) {
  const baseUrl = process.env.SMOKE_TEST_BASE_URL || process.argv[2];
  const timeoutMs = process.env.SMOKE_TEST_TIMEOUT_MS
    ? parseInt(process.env.SMOKE_TEST_TIMEOUT_MS, 10)
    : DEFAULT_TIMEOUT_MS;

  if (!baseUrl) {
    console.log('[smoke-test] FAIL: no base URL given (set SMOKE_TEST_BASE_URL or pass it as the first argument)');
    process.exitCode = 1;
  } else {
    run({ baseUrl, timeoutMs }).then((result) => {
      if (result.ok) {
        console.log(`[smoke-test] OK: /health/live and /health/ready both returned 200 after ${result.elapsedMs}ms`);
      } else {
        const detail = result.lastError ? result.lastError.message : `status ${result.lastStatus}`;
        console.log(`[smoke-test] FAIL: ${result.phase} never returned 200 within ${timeoutMs}ms (last: ${detail}, elapsed: ${result.elapsedMs}ms)`);
        process.exitCode = 1;
      }
    });
  }
}

module.exports = { run };
