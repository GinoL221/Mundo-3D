const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generate, check, runCli, serializeSpec, CHECK_FIX_COMMAND } = require('./generate-openapi-spec');

function tmpFilePath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-spec-test-')), 'openapi.json');
}

const SAMPLE_SPEC = { openapi: '3.0.0', paths: { '/a': { get: {} } } };
const buildSample = () => SAMPLE_SPEC;

test('serializeSpec: stable 2-space JSON with a trailing newline', () => {
  assert.equal(serializeSpec({ a: 1 }), '{\n  "a": 1\n}\n');
});

test('generate: writes the spec to outputPath using the canonical serialization', () => {
  const outputPath = tmpFilePath();
  generate({ outputPath, buildSpec: buildSample });
  assert.equal(fs.readFileSync(outputPath, 'utf8'), serializeSpec(SAMPLE_SPEC));
});

test('generate: two consecutive runs with unchanged source produce byte-identical files', () => {
  const outputPath = tmpFilePath();
  generate({ outputPath, buildSpec: buildSample });
  const first = fs.readFileSync(outputPath, 'utf8');
  generate({ outputPath, buildSpec: buildSample });
  const second = fs.readFileSync(outputPath, 'utf8');
  assert.equal(first, second);
});

test('generate: regeneration after a source change reflects the update and drops stale entries', () => {
  const outputPath = tmpFilePath();
  generate({ outputPath, buildSpec: buildSample });
  const updatedSpec = { openapi: '3.0.0', paths: { '/b': { post: {} } } };
  generate({ outputPath, buildSpec: () => updatedSpec });
  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.deepEqual(written, updatedSpec);
  assert.equal(written.paths['/a'], undefined);
});

test('check: matches=true and makes no write when the in-memory spec equals the committed file', () => {
  const outputPath = tmpFilePath();
  generate({ outputPath, buildSpec: buildSample });
  const before = fs.statSync(outputPath).mtimeMs;
  const result = check({ outputPath, buildSpec: buildSample });
  assert.equal(result.matches, true);
  assert.equal(fs.statSync(outputPath).mtimeMs, before);
});

test('check: matches=false when a fresh regeneration differs from the committed file', () => {
  const outputPath = tmpFilePath();
  generate({ outputPath, buildSpec: buildSample });
  const differentSpec = { openapi: '3.0.0', paths: { '/changed': { get: {} } } };
  const result = check({ outputPath, buildSpec: () => differentSpec });
  assert.equal(result.matches, false);
});

test('runCli default mode: writes the artifact and exits 0', () => {
  const outputPath = tmpFilePath();
  const logs = [];
  const code = runCli({ argv: [], outputPath, buildSpec: buildSample, log: (msg) => logs.push(msg) });
  assert.equal(code, 0);
  assert.equal(fs.readFileSync(outputPath, 'utf8'), serializeSpec(SAMPLE_SPEC));
});

test('runCli --check mode: exits 0 and makes no write when the spec matches', () => {
  const outputPath = tmpFilePath();
  generate({ outputPath, buildSpec: buildSample });
  const before = fs.readFileSync(outputPath, 'utf8');
  const logs = [];
  const code = runCli({ argv: ['--check'], outputPath, buildSpec: buildSample, log: (msg) => logs.push(msg) });
  assert.equal(code, 0);
  assert.equal(fs.readFileSync(outputPath, 'utf8'), before);
  assert.equal(logs.length, 0);
});

test('runCli --check mode: exits 1 and prints the exact fix command when the spec is stale', () => {
  const outputPath = tmpFilePath();
  generate({ outputPath, buildSpec: buildSample });
  const differentSpec = { openapi: '3.0.0', paths: { '/changed': { get: {} } } };
  const logs = [];
  const code = runCli({
    argv: ['--check'],
    outputPath,
    buildSpec: () => differentSpec,
    log: (msg) => logs.push(msg),
  });
  assert.equal(code, 1);
  assert.ok(logs.some((line) => line.includes(CHECK_FIX_COMMAND)));
});
