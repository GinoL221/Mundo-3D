import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCheck } from './quality-check.js';

function withSource(source, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-check-'));
  const srcDir = path.join(root, 'src');
  fs.mkdirSync(srcDir);
  fs.writeFileSync(path.join(srcDir, 'fixture.ts'), source);

  try {
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('accepts source files longer than the withdrawn size threshold', () => {
  const longSource = `${'const value = 1;\n'.repeat(300)}`;
  withSource(longSource, (root) => {
    assert.equal(runCheck(root, () => {}), 0);
  });
});

test('continues rejecting console.log in production source', () => {
  withSource('console.log("not allowed");\n', (root) => {
    const diagnostics = [];
    assert.equal(runCheck(root, (message) => diagnostics.push(message)), 1);
    assert.match(diagnostics[0], /console\.log found/);
  });
});
