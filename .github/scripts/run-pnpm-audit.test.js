const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const AUDIT_SCRIPT = path.join(__dirname, 'run-pnpm-audit.sh');
const EXPECTED_MYSQL_DIGEST =
  '7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b';
const EXPECTED_MYSQL_IMAGE = `mysql@sha256:${EXPECTED_MYSQL_DIGEST}`;

/**
 * Builds a fake `pnpm` whose answer depends on whether the invocation carries
 * `--prod`. The gate runs both trees in one invocation of the script, so a
 * double that answered identically to both would not prove which one blocked.
 */
function runAudit(production, development) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mundo-audit-'));
  const pnpm = path.join(directory, 'pnpm');
  fs.writeFileSync(
    pnpm,
    [
      '#!/usr/bin/env bash',
      'for argument in "$@"; do',
      '  if [ "$argument" = "--prod" ]; then',
      `    printf '%s\\n' '${production.output}'`,
      `    exit ${production.exitCode}`,
      '  fi',
      'done',
      `printf '%s\\n' '${development.output}'`,
      `exit ${development.exitCode}`,
      '',
    ].join('\n'),
  );
  fs.chmodSync(pnpm, 0o755);

  const result = childProcess.spawnSync('bash', [AUDIT_SCRIPT], {
    encoding: 'utf8',
    env: { PATH: `${directory}:${process.env.PATH}` },
  });
  fs.rmSync(directory, { recursive: true, force: true });
  return result;
}

function workflow() {
  return fs.readFileSync(WORKFLOW, 'utf8');
}

function validateWorkflow(source) {
  const actionReferences = [...source.matchAll(/^\s*-?\s*uses:\s+[^@\s]+@([^\s]+)(?:\s+#.*)?\s*$/gm)].map(
    (match) => match[1],
  );
  assert.ok(actionReferences.length >= 11, 'expected every current workflow action use');
  assert.ok(actionReferences.every((reference) => /^[a-f0-9]{40}$/.test(reference)));

  const mysqlReferences = [...source.matchAll(/image:\s+>\-\n\s*(mysql@sha256:[a-f0-9]{64})/g)].map(
    (match) => match[1],
  );
  // The E2E job provisions its own MySQL container per run, so the workflow keeps
  // a single service definition; every remaining MySQL image must still be pinned.
  assert.equal(mysqlReferences.length, 1);
  assert.ok(
    mysqlReferences.every((reference) => reference === EXPECTED_MYSQL_IMAGE),
    `expected every MySQL image reference to match ${EXPECTED_MYSQL_IMAGE}`,
  );
  assert.match(source, /run:\s+bash \.github\/scripts\/run-pnpm-audit\.sh/);
  assert.match(source, /node --test \.github\/scripts\/run-pnpm-audit\.test\.js/);
  assert.match(source, /contents: read/);
  assert.match(source, /cancel-in-progress: true/);
  assert.match(source, /timeout-minutes: 20/);
  assert.match(source, /needs: \[quality, integration, e2e\]/);
  assert.match(source, /if: always\(\)/);
  assert.match(source, /needs\.quality\.result.*!= "success"/);
  assert.match(source, /needs\.integration\.result.*!= "success"/);
  assert.match(source, /needs\.e2e\.result.*!= "success"/);
}

const CLEAN = { output: 'No known vulnerabilities found', exitCode: 0 };

test('clean production and development trees succeed and record AUDIT_OK', () => {
  const result = runAudit(CLEAN, CLEAN);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No known vulnerabilities found/);
  assert.match(result.stdout, /AUDIT_OK/);
});

test('a production advisory blocks the gate and is visibly classified', () => {
  const result = runAudit(
    { output: '{"advisories":{"qs":{"severity":"moderate"}}}', exitCode: 1 },
    { output: '{"advisories":{"qs":{"severity":"moderate"}}}', exitCode: 1 },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AUDIT_ADVISORY/);
});

test('development-only advisories are reported without blocking the gate', () => {
  const development = {
    output: '{"advisories":{"deepmerge":{"severity":"moderate"}}}',
    exitCode: 1,
  };
  const result = runAudit(CLEAN, development);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No known vulnerabilities found/);
  assert.match(result.stdout, /AUDIT_DEV_TREE_ADVISORY/);
  assert.match(result.stdout, /deepmerge/);
});

test('a production registry failure blocks and is visibly classified', () => {
  const result = runAudit(
    { output: 'ERR_PNPM_META_FETCH_FAIL request to registry failed: ENOTFOUND', exitCode: 1 },
    CLEAN,
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AUDIT_AVAILABILITY_FAILURE/);
});

test('an ambiguous production failure blocks and is visibly classified', () => {
  const result = runAudit({ output: 'pnpm exited unexpectedly', exitCode: 1 }, CLEAN);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AUDIT_EXECUTION_FAILURE/);
});

test('an unavailable development tree is reported instead of passing silently', () => {
  const result = runAudit(CLEAN, {
    output: 'ERR_PNPM_META_FETCH_FAIL request to registry failed: ENOTFOUND',
    exitCode: 1,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /AUDIT_DEV_TREE_UNAVAILABLE/);
});

test('the script runs the production gate and the development report separately', () => {
  const source = fs.readFileSync(AUDIT_SCRIPT, 'utf8');
  assert.match(source, /pnpm audit --prod/);
  assert.match(source, /pnpm audit(?! --prod)/);
});

test('workflow uses immutable references and preserves the verification foundations', () => {
  validateWorkflow(workflow());
});

test('Playwright cache uses the Node 24 pin without changing its cache contract', () => {
  const source = workflow();
  const cacheStep = source.match(
    /- name: Cache Playwright browsers\n([\s\S]*?)(?=\n\s*- name: Install Playwright Browsers)/,
  );

  assert.ok(cacheStep, 'expected the Playwright browser cache step');
  assert.match(
    cacheStep[0],
    /^\s+uses: actions\/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6\.1\.0$/m,
  );
  assert.match(cacheStep[0], /id: playwright-cache/);
  assert.match(cacheStep[0], /path: ~\/\.cache\/ms-playwright/);
  assert.match(
    cacheStep[0],
    /key: \$\{\{ runner\.os \}\}-playwright-\$\{\{ steps\.pw\.outputs\.v \}\}-pw1228/,
  );
  assert.match(source, /steps\.playwright-cache\.outputs\.cache-hit != 'true'/);
  assert.match(source, /steps\.playwright-cache\.outputs\.cache-hit == 'true'/);
});

test('mutable action references and invalid MySQL digests are rejected', () => {
  const source = workflow();
  assert.throws(() => validateWorkflow(source.replace(/@[a-f0-9]{40}/, '@v4')));
  assert.throws(() => validateWorkflow(source.replace(/@[a-f0-9]{40}/, '@v4#suffix')));
  assert.throws(() => validateWorkflow(source.replace(/[a-f0-9]{64}/, 'not-a-digest')));
  assert.throws(() =>
    validateWorkflow(
      source.replace(
        EXPECTED_MYSQL_DIGEST,
        '0'.repeat(64),
      ),
    ),
  );
});
