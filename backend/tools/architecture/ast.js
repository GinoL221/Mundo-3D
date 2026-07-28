const ts = require('typescript');

function extractEdges(source, text) {
  if (source.endsWith('.astro') || !/\.[cm]?[jt]sx?$/.test(source)) return [];
  const file = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true);
  const edges = [];
  const add = (node, kind, specifier) => {
    const { line, character } = file.getLineAndCharacterOfPosition(node.getStart(file));
    edges.push({ source, line: line + 1, column: character + 1, kind, specifier });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) add(node, 'import', node.moduleSpecifier.text);
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) add(node, 'export', node.moduleSpecifier.text);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && ts.isStringLiteral(node.moduleReference.expression)) add(node, 'import-equals', node.moduleReference.expression.text);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments.length === 1) {
      const arg = node.arguments[0];
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) add(node, 'require', arg.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return edges;
}

module.exports = { extractEdges };
