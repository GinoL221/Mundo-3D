const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const AUDIT_SCRIPT = path.join(__dirname, 'run-pnpm-audit.sh');

function runAudit(exitCode, output) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mundo-audit-'));
  const pnpm = path.join(directory, 'pnpm');
  fs.writeFileSync(pnpm, `#!/usr/bin/env bash\nprintf '%s\\n' '${output}'\nexit ${exitCode}\n`);
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
  const actionReferences = [...source.matchAll(/^\s*-?\s*uses:\s+[^@\s]+@([^\s]+)$/gm)].map(
    (match) => match[1],
  );
  assert.ok(actionReferences.length >= 11, 'expected every current workflow action use');
  assert.ok(actionReferences.every((reference) => /^[a-f0-9]{40}$/.test(reference)));

  const mysqlReferences = [...source.matchAll(/image:\s+>-\n\s*(mysql@sha256:[a-f0-9]{64})/g)].map(
    (match) => match[1],
  );
  assert.equal(mysqlReferences.length, 2);
  assert.equal(mysqlReferences[0], mysqlReferences[1]);
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

test('clean audit succeeds and records AUDIT_OK', () => {
  const result = runAudit(0, 'No known vulnerabilities found');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No known vulnerabilities found/);
  assert.match(result.stdout, /AUDIT_OK/);
});

test('advisory audit result remains nonzero and is visibly classified', () => {
  const result = runAudit(1, '{"advisories":{"lodash":{"severity":"high"}}}');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AUDIT_ADVISORY/);
});

test('registry or network audit failure remains nonzero and is visibly classified', () => {
  const result = runAudit(1, 'ERR_PNPM_META_FETCH_FAIL request to registry failed: ENOTFOUND');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AUDIT_AVAILABILITY_FAILURE/);
});

test('ambiguous audit failure remains nonzero and is visibly classified', () => {
  const result = runAudit(1, 'pnpm exited unexpectedly');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AUDIT_EXECUTION_FAILURE/);
});

test('workflow uses immutable references and preserves the verification foundations', () => {
  validateWorkflow(workflow());
});

test('mutable action references and invalid MySQL digests are rejected', () => {
  const source = workflow();
  assert.throws(() => validateWorkflow(source.replace(/@[a-f0-9]{40}/, '@v4')));
  assert.throws(() => validateWorkflow(source.replace(/[a-f0-9]{64}/, 'not-a-digest')));
});
