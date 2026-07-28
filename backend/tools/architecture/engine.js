const path = require('node:path');
const { builtinModules } = require('node:module');
const ts = require('typescript');
const { classifyFile, isCompositionRoot } = require('./config');

function resolveEdges(edges, options) {
  return edges.map((edge) => {
    const resolved = ts.resolveModuleName(edge.specifier, edge.source, options, ts.sys).resolvedModule;
    if (resolved) return { ...edge, classification: resolved.resolvedFileName.includes(`${path.sep}node_modules${path.sep}`) ? 'external' : 'local', resolvedTarget: resolved.resolvedFileName };
    return { ...edge, classification: isLocal(edge.specifier, options) ? 'unresolved-local' : 'external', resolvedTarget: null };
  }).sort((a, b) => a.source.localeCompare(b.source) || a.line - b.line || a.column - b.column);
}

function isLocal(specifier, options) {
  return specifier.startsWith('.') || path.isAbsolute(specifier) || specifier.startsWith('@/') || Object.keys(options.paths || {}).some((alias) => {
    const [start, end = ''] = alias.split('*');
    return specifier.startsWith(start) && specifier.endsWith(end);
  });
}

function evaluateEdges(edges, root) {
  return edges.flatMap((edge) => {
    if (edge.classification === 'unresolved-local') return [violation(edge, 'resolution.local')];
    if (classifyFile(edge.source) !== 'production') return [];
    const source = relative(root, edge.source);
    const target = relative(root, edge.resolvedTarget);
    const sourceLayer = layer(source);
    const targetLayer = layer(target);
    let rule = null;
    if (edge.classification === 'external') rule = externalRule(sourceLayer, edge.specifier);
    if (edge.classification === 'external') return rule ? [violation(edge, rule)] : [];
    if (sourceLayer === 'domain' && targetLayer !== 'domain') rule = 'backend.domain.inward';
    if (sourceLayer === 'application' && !(targetLayer === 'domain' || target.startsWith('backend/src/application/dtos/'))) rule = 'backend.application.contracts';
    if (sourceLayer === 'database' && ['domain', 'application', 'infrastructure'].includes(targetLayer)) rule = 'backend.database.isolation';
    if (sourceLayer === 'frontend-domain' && !(target.startsWith(`frontend/src/domains/${domain(source)}/`) || target === 'frontend/src/config.ts')) rule = 'frontend.domain.locality';
    if (sourceLayer === 'infrastructure' && source.startsWith('backend/src/infrastructure/routes/') && targetLayer && !isCompositionRoot(root, edge.source)) rule = 'composition.allowlist';
    return rule ? [violation(edge, rule)] : [];
  }).sort((a, b) => a.source.localeCompare(b.source) || a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule));
}

function relative(root, file) { return path.relative(root, file || '').replaceAll(path.sep, '/'); }
function domain(file) { return file.split('/')[3]; }
function layer(file) {
  if (file.startsWith('backend/src/domain/')) return 'domain';
  if (file.startsWith('backend/src/application/')) return 'application';
  if (file.startsWith('backend/src/database/')) return 'database';
  if (file.startsWith('backend/src/infrastructure/')) return 'infrastructure';
  return file.startsWith('frontend/src/domains/') ? 'frontend-domain' : null;
}
function externalRule(sourceLayer, specifier) {
  if (!['domain', 'application'].includes(sourceLayer)) return null;
  return specifier.startsWith('node:') || builtinModules.includes(specifier) || /^(express$|sequelize$|mysql2$|pino$|helmet$|cors$|csurf$|express-rate-limit$|multer$|express-validator$|express-session$)/.test(specifier)
    ? `backend.${sourceLayer === 'domain' ? 'domain.inward' : 'application.contracts'}` : null;
}
function violation(edge, rule) { return { source: edge.source, line: edge.line, column: edge.column, targetOrSpecifier: edge.resolvedTarget || edge.specifier, rule, message: `${rule}: ${edge.source} -> ${edge.resolvedTarget || edge.specifier}` }; }

module.exports = { evaluateEdges, resolveEdges };
