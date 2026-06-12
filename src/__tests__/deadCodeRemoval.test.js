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

  describe('Unused imports removed', () => {
    test('should not import User in viewShoppingCart.js', () => {
      const filePath = path.join(__dirname, '../../src/controllers/products/viewShoppingCart.js');
      const content = fs.readFileSync(filePath, 'utf-8');
      // Should not have the unused User import
      expect(content).not.toMatch(/const\s*\{\s*User\s*\}\s*=\s*require/);
    });

    test('should not have debug console.log in viewShoppingCart.js', () => {
      const filePath = path.join(__dirname, '../../src/controllers/products/viewShoppingCart.js');
      const content = fs.readFileSync(filePath, 'utf-8');
      // Should not have the debug console.log
      expect(content).not.toMatch(/console\.log\(/);
    });
  });

  describe('Unused middleware imports removed', () => {
    test('should not import guestMiddleware in productsRoutes.js', () => {
      const filePath = path.join(__dirname, '../../src/routes/productsRoutes.js');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toMatch(/guestMiddleware/);
    });
  });
});
