const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractEdges } = require('../../../tools/architecture/ast');
const { resolveEdges } = require('../../../tools/architecture/engine');
const { loadCompilerOptions, classifyFile } = require('../../../tools/architecture/config');

describe('AST and resolution foundations', () => {
  const source = path.join(os.tmpdir(), 'boundary-source.ts');

  test('extracts ESM, type-only, export, and static CommonJS edges', () => {
    const edges = extractEdges(source, "import type { T } from './types'; import x from './x'; export { x } from './y'; import ref = require('./legacy'); const z = require('./z'); const s = require(`./static`);");
    expect(edges.map(({ kind, specifier }) => [kind, specifier])).toEqual([
      ['import', './types'], ['import', './x'], ['export', './y'], ['import-equals', './legacy'], ['require', './z'], ['require', './static'],
    ]);
  });

  test('ignores dynamic import and non-static require forms', () => {
    const edges = extractEdges(source, "import('./lazy'); require(name); require(`./${name}`); module.require('./x'); require.resolve('./x');");
    expect(edges).toEqual([]);
  });

  test('does not parse Astro internals', () => {
    expect(extractEdges('/tmp/Page.astro', "--- import x from './x'; ---")).toEqual([]);
  });

  test('resolves extensions, indexes, and aliases deterministically', () => withTree((root) => {
    write(root, 'src/a.ts', "import './lib'; import '@/alias';");
    write(root, 'src/lib/index.ts', 'export {};');
    write(root, 'src/alias.ts', 'export {};');
    write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }));
    const sourceFile = path.join(root, 'src/a.ts');
    const edges = resolveEdges(extractEdges(sourceFile, fs.readFileSync(sourceFile, 'utf8')), loadCompilerOptions(path.join(root, 'tsconfig.json')));
    expect(edges.map(({ classification, resolvedTarget }) => [classification, path.relative(root, resolvedTarget)])).toEqual([
      ['local', 'src/lib/index.ts'], ['local', 'src/alias.ts'],
    ]);
  }));

  test('fails closed for unresolved relative and alias edges but keeps bare packages external', () => {
    const options = { baseUrl: os.tmpdir(), paths: { '~/*': ['src/*'] } };
    const edges = resolveEdges(extractEdges(source, "import './missing'; import '@/missing'; import '~/missing'; import 'not-installed-package';"), options);
    expect(edges.map(({ classification, specifier }) => [classification, specifier])).toEqual([
      ['unresolved-local', './missing'], ['unresolved-local', '@/missing'], ['unresolved-local', '~/missing'], ['external', 'not-installed-package'],
    ]);
  });

  test('classifies non-production files and documentation without extracting documentation edges', () => {
    expect(classifyFile('/repo/src/domain/__tests__/edge.test.ts')).toBe('test');
    expect(classifyFile('/repo/database/migrations/1.js')).toBe('migration');
    expect(classifyFile('/repo/tools/check.js')).toBe('tool');
    expect(extractEdges('/repo/README.md', "import x from './x'")).toEqual([]);
  });
});

function withTree(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-'));
  try { return run(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function write(root, file, value) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}
