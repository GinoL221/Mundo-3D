const fs = require('fs');
const path = require('path');

describe('Cart Image Path', () => {
  test('productCart.ejs should use /img/products/ path prefix for product images', () => {
    const filePath = path.join(__dirname, '../views/products/productCart.ejs');
    const content = fs.readFileSync(filePath, 'utf-8');

    // The img src should contain /img/products/
    expect(content).toContain('/img/products/<%=');
    // Should NOT have the old incorrect path /img/<%= without products/
    // Check that there's no src="/img/<%=" that isn't followed by "products/"
    const imgSrcMatches = content.match(/src="\/img\/[^"]*"/g) || [];
    imgSrcMatches.forEach((match) => {
      expect(match).toMatch(/\/img\/products\//);
    });
  });
});
