import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

describe('quality-check', () => {
  it('accepts source files longer than the withdrawn size threshold', () => {
    const longSource = `${'const value = 1;\n'.repeat(300)}`;
    withSource(longSource, (root) => {
      expect(runCheck(root, () => {})).toBe(0);
    });
  });

  it('continues rejecting console.log in production source', () => {
    withSource('console.log("not allowed");\n', (root) => {
      const diagnostics = [];
      expect(runCheck(root, (message) => diagnostics.push(message))).toBe(1);
      expect(diagnostics[0]).toMatch(/console\.log found/);
    });
  });
});
