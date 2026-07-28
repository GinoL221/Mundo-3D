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

const compositionRoots = new Set([
  'backend/index.js', 'backend/src/app.js',
  ...['index', 'products', 'users', 'cart', 'categories', 'franchises'].map((name) => `backend/src/infrastructure/routes/api/${name}.ts`),
  ...['sessionUI', 'cartBadge', 'crtToggle', 'themeToggle'].map((name) => `frontend/src/scripts/${name}.ts`),
  ...['index', 'products', 'product', 'cart', 'login', 'register', 'aboutUs', 'help', 'faq', 'privacy', 'terms', 'step-by-step'].map((name) => `frontend/src/pages/${name}.astro`),
  ...['index', 'create', 'edit'].map((name) => `frontend/src/pages/admin/products/${name}.astro`),
  'frontend/src/layouts/Layout.astro', ...['Header', 'Footer', 'Welcome'].map((name) => `frontend/src/components/${name}.astro`),
  'frontend/src/domains/auth/components/LoginForm.astro', 'frontend/src/domains/auth/components/RegisterForm.astro',
  'frontend/src/domains/cart/components/CartList.astro', 'frontend/src/domains/products/components/ProductCard.astro',
]);

function isCompositionRoot(root, file) {
  return compositionRoots.has(path.relative(root, file).replaceAll(path.sep, '/'));
}

module.exports = { classifyFile, isCompositionRoot, loadCompilerOptions };
