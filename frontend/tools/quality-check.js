// Enforces two repo-wide standards (AGENTS.md) that Astro has no lint
// pipeline for: no console.log in production code, and a 250-line cap per
// source file. Mirrors backend/tools/architecture/check.js's exit-code
// convention so both plug into CI the same way.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LINES = 250;
const SOURCE_EXTENSIONS = /\.(astro|ts|tsx)$/;
const TEST_FILE = /\.test\.ts$/;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return SOURCE_EXTENSIONS.test(entry.name) ? [entryPath] : [];
  });
}

export function runCheck(root, write = console.error) {
  const srcDir = path.join(root, 'src');
  if (!fs.existsSync(srcDir)) throw new Error(`source root does not exist: ${srcDir}`);

  const violations = [];

  for (const file of walk(srcDir)) {
    const relative = path.relative(root, file);
    const isTest = TEST_FILE.test(file);
    const content = fs.readFileSync(file, 'utf8');

    if (!isTest && /console\.log\s*\(/.test(content)) {
      violations.push(`${relative}: console.log found — use a proper error surface instead`);
    }

    if (!isTest) {
      const lineCount = content.split('\n').length;
      if (lineCount > MAX_LINES) {
        violations.push(`${relative}: ${lineCount} lines exceeds the ${MAX_LINES}-line cap`);
      }
    }
  }

  violations.forEach((violation) => write(violation));
  return violations.length ? 1 : 0;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  process.exitCode = runCheck(root);
}
