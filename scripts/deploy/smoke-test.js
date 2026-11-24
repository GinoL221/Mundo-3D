const http = require('node:http');
const https = require('node:https');

const POLL_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 120000;

function get(url, { readBody = false } = {}) {
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve) => {
    const req = client.get(url, (res) => {
      if (!readBody) {
        res.resume(); // drain, we only care about the status code
        resolve({ status: res.statusCode });
        return;
      }
      const chunks = [];
      res.setEncoding('utf8');
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: chunks.join('') }));
      res.on('error', (error) => resolve({ status: res.statusCode, error }));
    });
    // Connection refused, DNS failure, etc. — treated as a failed attempt,
    // not a thrown exception, so polling continues until the deadline.
    req.on('error', (error) => resolve({ status: null, error }));
  });
}

function parseExpectDemoEnabled(value) {
  if (value === undefined || value === null || value === '') {
    return { mode: null, error: null };
  }
  if (value === 'true' || value === 'false') {
    return { mode: value, error: null };
  }
  return {
    mode: null,
    error: new Error(
      `Invalid SMOKE_EXPECT_DEMO_ENABLED "${value}". Expected "true", "false", or empty.`,
    ),
  };
}

async function checkDemoStatus(baseUrl, expectedMode) {
  const { status, body, error } = await get(`${baseUrl}/api/demo/status`, {
    readBody: expectedMode === 'true',
  });
  if (error) {
    return { ok: false, lastStatus: status, lastError: error };
  }
  if (expectedMode === 'false') {
    if (status === 404) return { ok: true, lastStatus: status, lastError: null };
    return {
      ok: false,
      lastStatus: status,
      lastError: new Error(`expected 404 from /api/demo/status, got ${status}`),
    };
  }
  if (status !== 200) {
    return {
      ok: false,
      lastStatus: status,
      lastError: new Error(`expected 200 from /api/demo/status, got ${status}`),
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(body || '');
  } catch {
    return {
      ok: false,
      lastStatus: status,
      lastError: new Error('invalid JSON body from /api/demo/status'),
    };
  }
  if (!parsed || parsed.enabled !== true) {
    return {
      ok: false,
      lastStatus: status,
      lastError: new Error(
        `expected /api/demo/status JSON { enabled: true }, got ${JSON.stringify(parsed)}`,
      ),
    };
  }
  return { ok: true, lastStatus: status, lastError: null };
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
// once. Both phases share one overall timeoutMs budget. When expectDemoEnabled
// is "true" or "false", also verifies GET {baseUrl}/api/demo/status. Never throws.
async function run({ baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS, expectDemoEnabled } = {}) {
  const { mode: demoMode, error: configError } = parseExpectDemoEnabled(expectDemoEnabled);
  if (configError) {
    return { ok: false, phase: 'config', lastStatus: null, lastError: configError, elapsedMs: 0 };
  }

  const start = Date.now();
  const deadline = start + timeoutMs;

  const live = await pollUntilHealthy(baseUrl, '/health/live', deadline);
  if (!live.ok) {
    return { ok: false, phase: 'live', lastStatus: live.lastStatus, lastError: live.lastError, elapsedMs: Date.now() - start };
  }

  const ready = await pollUntilHealthy(baseUrl, '/health/ready', deadline);
  if (!ready.ok) {
    return {
      ok: false,
      phase: 'ready',
      lastStatus: ready.lastStatus,
      lastError: ready.lastError,
      elapsedMs: Date.now() - start,
    };
  }

  if (demoMode) {
    const demo = await checkDemoStatus(baseUrl, demoMode);
    return {
      ok: demo.ok,
      phase: demo.ok ? null : 'demo',
      lastStatus: demo.lastStatus,
      lastError: demo.lastError,
      elapsedMs: Date.now() - start,
    };
  }

  return {
    ok: true,
    phase: null,
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
  const expectDemoEnabled = process.env.SMOKE_EXPECT_DEMO_ENABLED;

  if (!baseUrl) {
    console.log('[smoke-test] FAIL: no base URL given (set SMOKE_TEST_BASE_URL or pass it as the first argument)');
    process.exitCode = 1;
  } else {
    run({ baseUrl, timeoutMs, expectDemoEnabled }).then((result) => {
      if (result.ok) {
        const { mode: demoMode } = parseExpectDemoEnabled(expectDemoEnabled);
        const message = demoMode
          ? `[smoke-test] OK: /health/live, /health/ready and /api/demo/status (expected enabled=${demoMode}) passed after ${result.elapsedMs}ms`
          : `[smoke-test] OK: /health/live and /health/ready both returned 200 after ${result.elapsedMs}ms`;
        console.log(message);
      } else if (result.phase === 'config') {
        console.log(`[smoke-test] FAIL: ${result.lastError.message}`);
        process.exitCode = 1;
      } else if (result.phase === 'demo') {
        const detail = result.lastError ? result.lastError.message : `status ${result.lastStatus}`;
        console.log(`[smoke-test] FAIL: /api/demo/status check failed (${detail}, elapsed: ${result.elapsedMs}ms)`);
        process.exitCode = 1;
      } else {
        const detail = result.lastError ? result.lastError.message : `status ${result.lastStatus}`;
        console.log(`[smoke-test] FAIL: ${result.phase} never returned 200 within ${timeoutMs}ms (last: ${detail}, elapsed: ${result.elapsedMs}ms)`);
        process.exitCode = 1;
      }
    });
  }
}

module.exports = { run, DEFAULT_TIMEOUT_MS };
