const fs = require('fs');
const path = require('path');

describe('Upload Factory', () => {
  let createUpload;

  beforeAll(() => {
    createUpload = require('../../src/middlewares/upload');
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
    const { validationsForm } = require('../../src/middlewares/validators/productValidators');
    expect(Array.isArray(validationsForm)).toBe(true);
    expect(validationsForm.length).toBeGreaterThan(0);
  });

  test('userValidators should export validationsUsers array', () => {
    const { validationsUsers } = require('../../src/middlewares/validators/userValidators');
    expect(Array.isArray(validationsUsers)).toBe(true);
    expect(validationsUsers.length).toBeGreaterThan(0);
  });

  test('userValidators should export loginValidation array', () => {
    const { loginValidation } = require('../../src/middlewares/validators/userValidators');
    expect(Array.isArray(loginValidation)).toBe(true);
    expect(loginValidation.length).toBeGreaterThan(0);
  });
});

describe('API Controller Structure', () => {
  let productApiController;

  beforeAll(() => {
    productApiController = require('../../src/controllers/api/productApiController');
  });

  test('should export index method', () => {
    expect(typeof productApiController.index).toBe('function');
  });

  test('should export show method', () => {
    expect(typeof productApiController.show).toBe('function');
  });

  test('should export latest method', () => {
    expect(typeof productApiController.latest).toBe('function');
  });
});

describe('API Route Delegation', () => {
  test('api/products.js should import productApiController', () => {
    const filePath = path.join(__dirname, '../../src/routes/api/products.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/productApiController/);
  });

  test('api/products.js should not have inline handler logic', () => {
    const filePath = path.join(__dirname, '../../src/routes/api/products.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    // Should delegate to controller, not have inline try/catch with ProductService
    expect(content).not.toMatch(/ProductService\.findAll/);
    expect(content).not.toMatch(/transformWithCategoryCount/);
  });
});

describe('Main Controller Barrel', () => {
  test('controllers/main/index.js should export home and aboutUs', () => {
    const { home, aboutUs } = require('../../src/controllers/main');
    expect(typeof home).toBe('function');
    expect(typeof aboutUs).toBe('function');
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
  test('mainRoutes.js should not use path.join for renders', () => {
    const filePath = path.join(__dirname, '../../src/routes/mainRoutes.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/path\.join.*views/);
  });

  test('home.js should use view names not path.join', () => {
    const filePath = path.join(__dirname, '../../src/controllers/main/home.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/path\.join/);
    expect(content).toMatch(/res\.render\('index'/);
  });

  test('aboutUs.js should use view names not path.join', () => {
    const filePath = path.join(__dirname, '../../src/controllers/main/aboutUs.js');
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
