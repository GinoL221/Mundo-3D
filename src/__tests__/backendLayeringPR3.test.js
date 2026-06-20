const fs = require('fs');
const path = require('path');

describe('Upload Factory', () => {
  let createUpload;

  beforeAll(() => {
    createUpload = require('../../src/infrastructure/middlewares/upload').default;
  });

  test('should be a function', () => {
    expect(typeof createUpload).toBe('function');
  });

  test('should return a multer instance with correct storage config', () => {
    const upload = createUpload('products');
    expect(upload).toBeDefined();
    expect(upload.single).toBeDefined();
    expect(typeof upload.single).toBe('function');
  });

  test('should accept different destinations', () => {
    const productsUpload = createUpload('products');
    const usersUpload = createUpload('users');
    expect(productsUpload).not.toBe(usersUpload);
    expect(typeof productsUpload.single).toBe('function');
    expect(typeof usersUpload.single).toBe('function');
  });
});

describe('Validator Modules', () => {
  test('productValidators should export validationsForm array', () => {
    const { validationsForm } = require('../../src/infrastructure/middlewares/validators/productValidators');
    expect(Array.isArray(validationsForm)).toBe(true);
    expect(validationsForm.length).toBeGreaterThan(0);
  });

  test('userValidators should export validationsUsers array', () => {
    const { validationsUsers } = require('../../src/infrastructure/middlewares/validators/userValidators');
    expect(Array.isArray(validationsUsers)).toBe(true);
    expect(validationsUsers.length).toBeGreaterThan(0);
  });

  test('userValidators should export loginValidation array', () => {
    const { loginValidation } = require('../../src/infrastructure/middlewares/validators/userValidators');
    expect(Array.isArray(loginValidation)).toBe(true);
    expect(loginValidation.length).toBeGreaterThan(0);
  });
});

describe('API Controller Structure', () => {
  let ProductApiController;
  let UserApiController;

  beforeAll(() => {
    ProductApiController = require('../../src/infrastructure/controllers/ProductApiController').ProductApiController;
    UserApiController = require('../../src/infrastructure/controllers/UserApiController').UserApiController;
  });

  test('ProductApiController should be a class with index, show, latest methods', () => {
    const controller = new ProductApiController(jest.fn(), jest.fn(), jest.fn());
    expect(typeof controller.index).toBe('function');
    expect(typeof controller.show).toBe('function');
    expect(typeof controller.latest).toBe('function');
  });

  test('UserApiController should be a class with login, index, show methods', () => {
    const controller = new UserApiController(jest.fn(), jest.fn(), jest.fn());
    expect(typeof controller.login).toBe('function');
    expect(typeof controller.index).toBe('function');
    expect(typeof controller.show).toBe('function');
  });
});

describe('API Route Delegation', () => {
  test('api/products.ts should import ProductApiController', () => {
    const filePath = path.join(__dirname, '../../src/infrastructure/routes/api/products.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/ProductApiController/);
  });

  test('api/products.ts should not have inline handler logic', () => {
    const filePath = path.join(__dirname, '../../src/infrastructure/routes/api/products.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/ProductService\.findAll/i);
    expect(content).not.toMatch(/transformWithCategoryCount/i);
  });
});

describe.skip('Retired - Main Controller Barrel (EJS MVC removed in PR3)', () => {
  test('controllers/main barrel should no longer exist', () => {
    const dirPath = path.join(__dirname, '../../src/controllers/main');
    expect(fs.existsSync(dirPath)).toBe(false);
  });

  test('StaticPagesController should expose home and aboutUs as functions', () => {
    // Retired: StaticPagesController deleted in PR3 (replaced by Astro SSG pages)
  });

  test('old mainController.js should be deleted', () => {
    const filePath = path.join(__dirname, '../../src/controllers/mainController.js');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe.skip('Retired - Route File Cleanup (legacy JS routes superseded by API routes in PR1)', () => {
  // These tests verified old src/routes/*.js files.
  // In PR1 all routing was migrated to src/infrastructure/routes/api/.
  // The legacy src/routes/ files are retained as-is but no longer mounted in app.js.
});

describe.skip('Retired - Controller Path.join Cleanup (EJS MVC removed in PR3)', () => {
  // staticPagesRoutes.ts and StaticPagesController.ts deleted in PR3.
  // Static pages (aboutUs, faq, etc.) now pre-rendered by Astro SSG.
});

describe.skip('Retired - No bcrypt in Controllers (legacy MVC controllers removed in PR3)', () => {
  // processLogin.js was part of legacy MVC; replaced by UserApiController with BcryptPasswordHasher.
});
