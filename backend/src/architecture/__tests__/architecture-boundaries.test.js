const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractEdges } = require('../../../tools/architecture/ast');
const { resolveEdges, evaluateEdges } = require('../../../tools/architecture/engine');
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

  test('resolves only exact local Astro files as opaque local edges', () => withTree((root) => {
    const source = path.join(root, 'backend/src/domain/nested/source.ts');
    ['backend/src/domain/nested/Local.astro', 'backend/src/domain/Sibling.astro', 'backend/src/shared/Multi.astro', 'backend/src/domain/nested/dir/index.astro'].forEach((file) => write(root, file, '--- import hidden from "./hidden"; ---'));
    write(root, 'backend/src/domain/nested/source.ts', '');
    fs.symlinkSync(path.join(root, 'backend/src/domain/Sibling.astro'), path.join(root, 'backend/src/domain/nested/linked.astro'));
    const edges = resolveEdges(extractEdges(source, "import './Local.astro'; import '../Sibling.astro'; import '../../shared/Multi.astro'; import './dir/index.astro'; import './linked.astro';"), {});
    expect(edges.map(({ classification, resolvedTarget }) => [classification, path.relative(root, resolvedTarget)])).toEqual([
      ['local', 'backend/src/domain/nested/Local.astro'], ['local', 'backend/src/domain/Sibling.astro'], ['local', 'backend/src/shared/Multi.astro'], ['local', 'backend/src/domain/nested/dir/index.astro'], ['local', 'backend/src/domain/nested/linked.astro'],
    ]);
    expect(extractEdges(edges[0].resolvedTarget, fs.readFileSync(edges[0].resolvedTarget, 'utf8'))).toEqual([]);
  }));

  test('fails closed for invalid Astro fallback forms and unsafe targets', () => withTree((root) => {
    const source = path.join(root, 'backend/src/domain/source.ts');
    const outside = path.join(os.tmpdir(), `outside-${path.basename(root)}.astro`);
    write(root, 'backend/src/domain/source.ts', ''); write(root, 'backend/src/domain/dir.astro/child', ''); write(root, 'backend/src/domain/file.astro', ''); write(root, 'backend/src/domain/dir/..\\file.astro', ''); fs.writeFileSync(outside, '');
    fs.symlinkSync(outside, path.join(root, 'backend/src/domain/outside.astro'));
    fs.symlinkSync(path.join(root, 'missing.astro'), path.join(root, 'backend/src/domain/dangling.astro'));
    const specifiers = ['./missing.astro', './dir.astro', './dir/', './dir/index', './file.astro?x', './file.astro#x', './file.js', '/file.astro', 'C:\\\\file.astro', '\\\\\\\\server\\\\file.astro', '@/file.astro', 'package/file.astro', '././file.astro', './dir/../file.astro', './outside.astro', './dangling.astro'];
    specifiers.splice(-2, 0, './dir/..\\\\file.astro');
    const edges = resolveEdges(extractEdges(source, specifiers.map((specifier) => `import '${specifier}';`).join(' ')), {});
    expect(edges.map(({ classification }) => classification)).toEqual(specifiers.map((specifier) => specifier === 'package/file.astro' ? 'external' : 'unresolved-local'));
    expect(resolveEdges(extractEdges(path.join(root, 'other/source.ts'), "import './file.astro';"), {}).map(({ classification }) => classification)).toEqual(['unresolved-local']);
    fs.unlinkSync(outside);
  }));

  test('does not retain the unused application use-case barrel', () => {
    expect(fs.existsSync(path.join(__dirname, '../../application/use-cases/index.ts'))).toBe(false);
  });

  test('classifies non-production files and documentation without extracting documentation edges', () => {
    expect(classifyFile('/repo/src/domain/__tests__/edge.test.ts')).toBe('test');
    expect(classifyFile('/repo/database/migrations/1.js')).toBe('migration');
    expect(classifyFile('/repo/tools/check.js')).toBe('tool');
    expect(extractEdges('/repo/README.md', "import x from './x'")).toEqual([]);
  });
});

describe('rules, allowlists, and diagnostics', () => {
  const root = '/repo';
  const edge = (source, target, kind = 'import') => ({ source: `${root}/${source}`, line: 2, column: 3, kind, specifier: './target', classification: 'local', resolvedTarget: `${root}/${target}` });

  test.each([
    ['S1 domain contract', edge('backend/src/domain/entities/a.ts', 'backend/src/domain/ports/p.ts'), null],
    ['S2 domain outward', edge('backend/src/domain/entities/a.ts', 'backend/src/infrastructure/x.ts'), 'backend.domain.inward'],
    ['domain local UI/unclassified', edge('backend/src/domain/entities/a.ts', 'backend/src/ui/x.ts'), 'backend.domain.inward'],
    ['S2 domain framework', { ...edge('backend/src/domain/a.ts', 'node_modules/express/index.js'), classification: 'external', specifier: 'express' }, 'backend.domain.inward'],
    ['S3 application port', edge('backend/src/application/use-cases/a.ts', 'backend/src/domain/ports/p.ts'), null],
    ['application DTO', edge('backend/src/application/use-cases/a.ts', 'backend/src/application/dtos/a.ts'), null],
    ['application arbitrary module', edge('backend/src/application/use-cases/a.ts', 'backend/src/application/use-cases/b.ts'), 'backend.application.contracts'],
    ['S4 application adapter', edge('backend/src/application/use-cases/a.ts', 'backend/src/infrastructure/repositories/r.ts'), 'backend.application.contracts'],
    ['S4 application I/O', { ...edge('backend/src/application/a.ts', 'node_modules/x/index.js'), classification: 'external', specifier: 'node:fs' }, 'backend.application.contracts'],
    ['domain other I/O package', { ...edge('backend/src/domain/a.ts', 'node_modules/mysql2/index.js'), classification: 'external', specifier: 'mysql2' }, 'backend.domain.inward'],
    ['domain bare Node I/O', { ...edge('backend/src/domain/a.ts', 'node_modules/fs/index.js'), classification: 'external', specifier: 'fs' }, 'backend.domain.inward'],
    ['S5 database ORM', { ...edge('backend/src/database/models/a.ts', 'node_modules/sequelize/index.js'), classification: 'external' }, null],
    ['S6 database inward', edge('backend/src/database/models/a.ts', 'backend/src/domain/entities/a.ts'), 'backend.database.isolation'],
    ['infrastructure database edge', edge('backend/src/infrastructure/repositories/a.ts', 'backend/src/database/models/a.ts'), null],
    ['S7 CommonJS outward', edge('backend/src/domain/a.js', 'backend/src/database/a.js', 'require'), 'backend.domain.inward'],
    ['S8 test edge', edge('backend/src/domain/__tests__/a.test.ts', 'backend/src/infrastructure/a.ts'), null],
    ['S9 frontend local/config/external', edge('frontend/src/domains/auth/a.ts', 'frontend/src/domains/auth/b.ts'), null],
    ['S10/S12 frontend cross-boundary', edge('frontend/src/domains/auth/a.ts', 'frontend/src/components/Header.ts'), 'frontend.domain.locality'],
    ['S13 unresolved local', { ...edge('backend/src/domain/a.ts', 'missing.ts'), classification: 'unresolved-local', resolvedTarget: null }, 'resolution.local'],
    ['S14 external', { ...edge('backend/src/domain/a.ts', 'node_modules/pkg/index.js'), classification: 'external' }, null],
    ['S16 migration edge', edge('backend/src/database/migrations/a.ts', 'backend/src/domain/a.ts'), null],
  ])('%s', (_, input, rule) => {
    expect(evaluateEdges([input], root).map((item) => item.rule)).toEqual(rule ? [rule] : []);
  });

  test('S11/S17-S19 use exact composition paths without inheritance and leave Astro unparsed', () => {
    const allowed = edge('backend/src/infrastructure/routes/api/products.ts', 'backend/src/database/models/a.ts');
    const sibling = edge('backend/src/infrastructure/routes/api/orders.ts', 'backend/src/database/models/a.ts');
    expect(evaluateEdges([allowed, sibling], root).map((item) => item.rule)).toEqual(['composition.allowlist']);
    expect(extractEdges(`${root}/frontend/src/pages/index.astro`, "--- import x from '../domains/auth/a'; ---")).toEqual([]);
  });

  test('S20/S21 diagnostics include source target/rule and sort deterministically', () => {
    const later = { ...edge('backend/src/domain/a.ts', 'backend/src/database/z.ts'), line: 3, column: 1 };
    const earlier = { ...edge('backend/src/domain/a.ts', 'backend/src/database/a.ts'), line: 2, column: 3 };
    expect(evaluateEdges([later, earlier], root)).toEqual([
      expect.objectContaining({ source: earlier.source, targetOrSpecifier: earlier.resolvedTarget, rule: 'backend.domain.inward', line: 2, column: 3 }),
      expect.objectContaining({ source: later.source, targetOrSpecifier: later.resolvedTarget, rule: 'backend.domain.inward', line: 3, column: 1 }),
    ]);
  });
});

describe('architecture check CLI', () => {
  test('S22 exits zero when discovered edges are valid', () => withTree((root) => {
    write(root, 'backend/src/domain/a.ts', "import './ports/p';");
    write(root, 'backend/src/domain/ports/p.ts', 'export {};');
    expect(run(root)).toEqual({ code: 0, output: [] });
  }));

  test('S23 exits non-zero for an architecture violation', () => withTree((root) => {
    write(root, 'backend/src/domain/a.ts', "import '../infrastructure/x';");
    write(root, 'backend/src/infrastructure/x.ts', 'export {};');
    expect(run(root)).toEqual({ code: 1, output: [`backend.domain.inward: ${path.join(root, 'backend/src/domain/a.ts')} -> ${path.join(root, 'backend/src/infrastructure/x.ts')}`] });
  }));

  test('S23 blocks unavailable source discovery errors', () => {
    expect(run(path.join(os.tmpdir(), 'missing-architecture-root')).code).toBe(1);
  });

  test('S24 runs without a verification-baseline-and-ci-gates path', () => withTree((root) => {
    write(root, 'backend/src/domain/a.ts', 'export {};');
    expect(run(root).code).toBe(0);
  }));

  test('S25 only discovers source files and does not execute runtime entrypoints', () => withTree((root) => {
    write(root, 'backend/index.js', 'throw new Error("runtime must not run");');
    write(root, 'backend/src/domain/a.ts', 'export {};');
    expect(run(root)).toEqual({ code: 0, output: [] });
  }));
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

function run(root) {
  const output = [];
  const { runCheck } = require('../../../tools/architecture/check');
  return { code: runCheck(root, (line) => output.push(line)), output };
}
