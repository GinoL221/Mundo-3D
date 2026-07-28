const path = require('node:path');
const ts = require('typescript');

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

module.exports = { resolveEdges };
