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
});
