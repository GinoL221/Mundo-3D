const path = require('node:path');
const ts = require('typescript');

function loadCompilerOptions(configPath) {
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
  return ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath)).options;
}

function classifyFile(file) {
  if (!/\.[cm]?[jt]sx?$/.test(file)) return 'documentation';
  if (/(__tests__|\.(test|spec)\.[cm]?[jt]sx?$)/.test(file)) return 'test';
  if (/database\/migrations\//.test(file)) return 'migration';
  if (/(^|\/)tools\//.test(file)) return 'tool';
  if (/(^|\/)(package|tsconfig|eslint).*\./.test(file)) return 'config';
  return 'production';
}

module.exports = { classifyFile, loadCompilerOptions };
