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

describe('Main Controller Barrel', () => {
  test('controllers/main barrel should no longer exist', () => {
    const dirPath = path.join(__dirname, '../../src/controllers/main');
    expect(fs.existsSync(dirPath)).toBe(false);
  });

  test('StaticPagesController should expose home and aboutUs as functions', () => {
    const {
      StaticPagesController,
    } = require('../../src/infrastructure/controllers/StaticPagesController');
    const controller = new StaticPagesController({ execute: jest.fn() });
    expect(typeof controller.home).toBe('function');
    expect(typeof controller.aboutUs).toBe('function');
  });

  test('old mainController.js should be deleted', () => {
    const filePath = path.join(__dirname, '../../src/controllers/mainController.js');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe('Route File Cleanup', () => {
  test('productsRoutes.js should not have inline multer config', () => {
    const filePath = path.join(__dirname, '../../src/routes/productsRoutes.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/multer\.diskStorage/);
    expect(content).toMatch(/require\('\.\.\/middlewares\/upload'\)/);
  });

  test('userRoutes.js should not have inline multer config', () => {
    const filePath = path.join(__dirname, '../../src/routes/userRoutes.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/multer\.diskStorage/);
    expect(content).toMatch(/require\('\.\.\/middlewares\/upload'\)/);
  });

  test('productsRoutes.js should not have inline validationsForm', () => {
    const filePath = path.join(__dirname, '../../src/routes/productsRoutes.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    // Should import validators, not define inline
    expect(content).toMatch(/require\('\.\.\/middlewares\/validators\/productValidators'\)/);
    // Should not have inline body() definitions
    expect(content).not.toMatch(/body\('productName'\)/);
  });

  test('userRoutes.js should not have inline validators', () => {
    const filePath = path.join(__dirname, '../../src/routes/userRoutes.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/require\('\.\.\/middlewares\/validators\/userValidators'\)/);
    expect(content).not.toMatch(/body\('firstName'\)/);
  });
});

describe('Controller Path.join Cleanup', () => {
  test('mainRoutes.js should no longer exist', () => {
    const filePath = path.join(__dirname, '../../src/routes/mainRoutes.js');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('staticPagesRoutes.ts should exist and export a default router', () => {
    const filePath = path.join(
      __dirname,
      '../../src/infrastructure/routes/staticPagesRoutes.ts',
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/export default/);
  });

  test('StaticPagesController.ts home should use ListProductsUseCase, not productService, and render index', () => {
    const filePath = path.join(
      __dirname,
      '../../src/infrastructure/controllers/StaticPagesController.ts',
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/res\.render\('index'/);
    expect(content).toMatch(/ListProductsUseCase/);
    expect(content).not.toMatch(/productService/i);
  });

  test('StaticPagesController.ts aboutUs should use view names not path.join', () => {
    const filePath = path.join(
      __dirname,
      '../../src/infrastructure/controllers/StaticPagesController.ts',
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/path\.join/);
    expect(content).toMatch(/res\.render\('aboutUs'/);
  });
});

describe('No bcrypt in Controllers', () => {
  test('processLogin.js should not import bcrypt', () => {
    const filePath = path.join(__dirname, '../../src/controllers/users/processLogin.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/require\(['"]bcrypt/);
    expect(content).not.toMatch(/bcrypt\.compareSync/);
  });
});
