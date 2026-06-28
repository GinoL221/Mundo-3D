const fs = require('fs');
const path = require('path');

describe('Dead Code Removal', () => {
  describe('Deleted EJS views', () => {
    test('should not have src/views/products/product.ejs', () => {
      const filePath = path.join(__dirname, '../../src/views/products/product.ejs');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    test('should not have src/views/products/productMenu.ejs', () => {
      const filePath = path.join(__dirname, '../../src/views/products/productMenu.ejs');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    test('should not have src/views/users/newUser.ejs', () => {
      const filePath = path.join(__dirname, '../../src/views/users/newUser.ejs');
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  // Removed obsolete viewShoppingCart.js checks


  describe('Deleted legacy routes', () => {
    test('should not have src/routes/productsRoutes.js', () => {
      const filePath = path.join(__dirname, '../../src/routes/productsRoutes.js');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    test('should not have src/routes/userRoutes.js', () => {
      const filePath = path.join(__dirname, '../../src/routes/userRoutes.js');
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('Deleted orphaned middlewares', () => {
    test('should not have src/infrastructure/middlewares/csrf.ts', () => {
      const filePath = path.join(__dirname, '../infrastructure/middlewares/csrf.ts');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    test('should not have src/infrastructure/middlewares/__tests__/csrf.test.ts', () => {
      const filePath = path.join(__dirname, '../infrastructure/middlewares/__tests__/csrf.test.ts');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    test('should not have src/infrastructure/middlewares/userLogged.ts', () => {
      const filePath = path.join(__dirname, '../infrastructure/middlewares/userLogged.ts');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    test('should not have src/infrastructure/middlewares/cartCount.ts', () => {
      const filePath = path.join(__dirname, '../infrastructure/middlewares/cartCount.ts');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    test('should not have src/infrastructure/middlewares/__tests__/cartCount.test.ts', () => {
      const filePath = path.join(__dirname, '../infrastructure/middlewares/__tests__/cartCount.test.ts');
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });
});
