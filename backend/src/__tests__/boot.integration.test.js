/**
 * Real-process boot smoke test — spawns an actual `node index.js` (no
 * ts-jest, no module mocks) with `JEST_WORKER_ID` deleted so the entry
 * point's `if (!process.env.JEST_WORKER_ID) require('ts-node/register')`
 * guard takes the branch `ts-jest` never exercises. Runs only via
 * `pnpm --filter backend test:integration` (see jest.integration.config.js);
 * excluded from `test:fast` by jest.config.js's
 * `testPathIgnorePatterns: [... '\\.integration\\.test\\.(ts|js)$']`.
 *
 * `NODE_ENV=test` means index.js's immediate-listen boot path runs (no DB
 * auth/migrate/seed), so this never touches a real database.
 */
const { spawn } = require('child_process');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

function extractPort(output) {
  const lines = output.split('\n').filter(Boolean);
  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      // Not a structured Pino line (e.g. a stray non-JSON write) — skip it.
      continue;
    }
    if (parsed && typeof parsed.port === 'number' && parsed.port > 0) {
      return parsed.port;
    }
  }
  return null;
}

function waitFor(getValue, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const value = getValue();
      if (value !== null && value !== undefined) {
        resolve(value);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for a value`));
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

describe('boot.integration: real `node index.js` process', () => {
  it(
    'boots via the real ts-node/register path, serves GET /health/ready with 200, and exits cleanly on SIGTERM',
    async () => {
      const env = { ...process.env };
      delete env.JEST_WORKER_ID;
      env.NODE_ENV = 'test';
      env.PORT = '0';
      // logger.ts defaults to `silent` under NODE_ENV=test; force structured
      // output for this one spawn so the OS-assigned ephemeral port
      // (PORT=0) can be read back from the boot log line.
      env.LOG_LEVEL = 'info';

      const child = spawn('node', ['index.js'], {
        cwd: BACKEND_ROOT,
        env,
        shell: false,
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      let port;
      try {
        port = await waitFor(() => extractPort(stdout), 10000);
      } catch (waitErr) {
        child.kill('SIGKILL');
        throw new Error(
          `Boot log never reported a listening port.\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}\n${waitErr.message}`,
          { cause: waitErr }
        );
      }

      expect(port).toEqual(expect.any(Number));
      expect(port).toBeGreaterThan(0);

      const response = await fetch(`http://127.0.0.1:${port}/health/ready`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });

      const exitCode = await new Promise((resolve) => {
        child.once('exit', (code) => resolve(code));
        child.kill('SIGTERM');
      });

      expect(exitCode).toBe(0);
    },
    20000
  );
});
