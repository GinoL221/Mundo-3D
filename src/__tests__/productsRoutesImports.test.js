const fs = require('fs');
const path = require('path');

describe('Products Routes Imports', () => {
  test('should not import guestMiddleware in productsRoutes.js', () => {
    const filePath = path.join(
      __dirname,
      '../../src/routes/productsRoutes.js'
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    // guestMiddleware should not be in the destructure
    expect(content).not.toMatch(/guestMiddleware/);
    // isUser should still be imported
    expect(content).toMatch(/isUser/);
  });

  test('should still import isUser from auth middleware', () => {
    const filePath = path.join(
      __dirname,
      '../../src/routes/productsRoutes.js'
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/require\('\.\.\/middlewares\/auth'\)/);
  });
});
