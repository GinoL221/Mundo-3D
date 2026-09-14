// Enforces the repo-wide console.log standard (AGENTS.md) for Astro source,
// which is not covered by the frontend ESLint pipeline. Mirrors
// backend/tools/architecture/check.js's exit-code convention so both plug into
// CI the same way. Test files remain exempt because their diagnostic output does
// not ship in production paths.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  }

  violations.forEach((violation) => write(violation));
  return violations.length ? 1 : 0;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  process.exitCode = runCheck(root);
}
