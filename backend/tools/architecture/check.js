const fs = require('node:fs');
const path = require('node:path');
const { extractEdges } = require('./ast');
const { loadCompilerOptions } = require('./config');
const { evaluateEdges, resolveEdges } = require('./engine');

function discoverSources(root) {
  if (!fs.existsSync(root)) throw new Error(`source root does not exist: ${root}`);
  return ['backend/src', 'frontend/src'].flatMap((directory) => {
    const target = path.join(root, directory);
    return fs.existsSync(target) ? walk(target) : [];
  });
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(file);
    return /\.[cm]?[jt]sx?$/.test(file) ? [file] : [];
  });
}

function runCheck(root = path.resolve(__dirname, '../../..'), write = console.error) {
  try {
    const config = path.join(root, 'backend/tsconfig.json');
    const options = fs.existsSync(config) ? loadCompilerOptions(config) : {};
    const edges = discoverSources(root).flatMap((source) => resolveEdges(
      extractEdges(source, fs.readFileSync(source, 'utf8')),
      options,
    ));
    const violations = evaluateEdges(edges, root);
    violations.forEach((violation) => write(violation.message));
    return violations.length ? 1 : 0;
  } catch (error) {
    write(`architecture check unavailable: ${error.message}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = runCheck();

module.exports = { discoverSources, runCheck };
