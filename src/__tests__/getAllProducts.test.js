const getAllProducts = require('../controllers/products/getAllProducts');
const { ProductService } = require('../services');
const fs = require('fs');
const path = require('path');

jest.mock('../services', () => ({
  ProductService: {
    findAll: jest.fn(),
  },
}));

describe('getAllProducts Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with relative view path products/products', async () => {
    const mockProducts = [{ IDProduct: 1, NameProduct: 'Product A' }];
    ProductService.findAll.mockResolvedValue(mockProducts);

    const req = {};
    const res = {
      render: jest.fn(),
    };
    const next = jest.fn();

    await getAllProducts(req, res, next);

    expect(ProductService.findAll).toHaveBeenCalledTimes(1);
    expect(res.render).toHaveBeenCalledWith('products/products', {
      allProducts: mockProducts,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should not use path.join or __dirname in getAllProducts.js', () => {
    const filePath = path.join(__dirname, '../controllers/products/getAllProducts.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/path\.join/);
    expect(content).not.toMatch(/__dirname/);
  });

  it('calls next(error) when ProductService.findAll throws an error', async () => {
    const error = new Error('Database connection failed');
    ProductService.findAll.mockRejectedValue(error);

    const req = {};
    const res = {
      render: jest.fn(),
    };
    const next = jest.fn();

    await getAllProducts(req, res, next);

    expect(ProductService.findAll).toHaveBeenCalledTimes(1);
    expect(res.render).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });
});
