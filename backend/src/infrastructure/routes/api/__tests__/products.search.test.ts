import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { Product } from '../../../../domain/entities/Product';
import { Category } from '../../../../domain/entities/Category';
import { Franchise } from '../../../../domain/entities/Franchise';

// This is the wiring-level integration test for `GET /products/search`
// (product-catalog-search spec, Work Unit 2). It exercises the REAL Express
// pipeline — route -> searchProductsValidation -> controller.search ->
// SearchProductsUseCase -> repository — with only `SequelizeProductRepository`
// mocked at the module boundary, so it never touches a real database (stays
// in the default `npm test` mock-only suite; see `*.integration.test.ts`
// files for the separate real-DB suite run via `npm run test:integration`).
//
// The WHERE-clause construction itself (Op.or across name_product AND
// description_product, %/_/\ escaping, Op.and combination, idProduct ASC
// ordering, no `distinct`) is already unit-tested against a mocked
// `db.Product.findAndCountAll` in `SequelizeProductRepository.test.ts`
// (Work Unit 1). Case-insensitivity is inherited from the `utf8mb4_unicode_ci`
// column collation (design.md finding #1) — a real-DB concern outside this
// mock-only suite's reach. This suite instead proves the WIRING contract:
// routing, validation short-circuiting, defaults, envelope shape, and that
// query params reach `searchPaged` untouched (no premature lower-casing or
// escaping at the controller/validator layer, which would double-transform).
const mockSearchPaged = jest.fn();

jest.mock('../../../repositories/SequelizeProductRepository', () => ({
  SequelizeProductRepository: jest.fn().mockImplementation(() => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findLatest: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    adjustStock: jest.fn(),
    searchPaged: mockSearchPaged,
  })),
}));

const buildApp = (): Express => {
  const productsRouter = require('../products').default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', productsRouter);
  return app;
};

function makeProduct(idProduct: number): Product {
  return new Product(
    idProduct,
    `Product ${idProduct}`,
    100,
    'A description',
    'image.png',
    1,
    2,
    new Category(1, 'Figuras'),
    new Franchise(2, 'Dragon Ball')
  );
}

describe('GET /api/products/search', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns only matching products for a search term alone', async () => {
    mockSearchPaged.mockResolvedValue({ products: [makeProduct(1)], total: 1 });

    const res = await request(app).get('/api/products/search?search=goku');

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(mockSearchPaged).toHaveBeenCalledWith({
      search: 'goku',
      idCategory: undefined,
      idFranchise: undefined,
      limit: 20,
      offset: 0,
    });
  });

  it('filters by category alone', async () => {
    mockSearchPaged.mockResolvedValue({ products: [makeProduct(2)], total: 1 });

    await request(app).get('/api/products/search?idCategory=3');

    expect(mockSearchPaged).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined, idCategory: 3, idFranchise: undefined })
    );
  });

  it('filters by franchise alone', async () => {
    mockSearchPaged.mockResolvedValue({ products: [makeProduct(3)], total: 1 });

    await request(app).get('/api/products/search?idFranchise=5');

    expect(mockSearchPaged).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined, idCategory: undefined, idFranchise: 5 })
    );
  });

  it('combines search, idCategory and idFranchise with AND semantics forwarded together', async () => {
    mockSearchPaged.mockResolvedValue({ products: [makeProduct(4)], total: 1 });

    await request(app).get('/api/products/search?search=goku&idCategory=3&idFranchise=5');

    expect(mockSearchPaged).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'goku', idCategory: 3, idFranchise: 5 })
    );
  });

  it('forwards the search term with its original casing untouched (collation, not the app layer, is case-insensitive)', async () => {
    mockSearchPaged.mockResolvedValue({ products: [], total: 0 });

    await request(app).get('/api/products/search?search=GoKu');

    expect(mockSearchPaged).toHaveBeenCalledWith(expect.objectContaining({ search: 'GoKu' }));
  });

  it('forwards a literal % term untouched — escaping happens in the repository layer', async () => {
    mockSearchPaged.mockResolvedValue({ products: [], total: 0 });

    await request(app).get('/api/products/search?search=50%25');

    expect(mockSearchPaged).toHaveBeenCalledWith(expect.objectContaining({ search: '50%' }));
  });

  it("a search term containing a single quote returns a plain 200, not a crash", async () => {
    mockSearchPaged.mockResolvedValue({ products: [], total: 0 });

    const res = await request(app).get("/api/products/search").query({ search: "o'brien" });

    expect(res.status).toBe(200);
  });

  it('returns 200 with an empty page — never 404 — when nothing matches', async () => {
    mockSearchPaged.mockResolvedValue({ products: [], total: 0 });

    const res = await request(app).get('/api/products/search?search=nonexistent');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ products: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });

  it('applies page=1/pageSize=20 defaults when omitted', async () => {
    mockSearchPaged.mockResolvedValue({ products: [], total: 0 });

    await request(app).get('/api/products/search');

    expect(mockSearchPaged).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 0 }));
  });

  it('accepts custom page=2&pageSize=10', async () => {
    mockSearchPaged.mockResolvedValue({ products: [], total: 0 });

    await request(app).get('/api/products/search?page=2&pageSize=10');

    expect(mockSearchPaged).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 10 }));
  });

  it.each([['page', '0'], ['page', '-1'], ['page', 'abc'], ['pageSize', '0'], ['pageSize', '51']])(
    'rejects invalid %s=%s with 400 INVALID_PAGINATION',
    async (param, value) => {
      const res = await request(app).get(`/api/products/search?${param}=${value}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PAGINATION');
      expect(mockSearchPaged).not.toHaveBeenCalled();
    }
  );

  it.each([['idCategory', 'abc'], ['idFranchise', 'abc']])(
    'rejects a non-integer %s=%s with 400 INVALID_FILTER',
    async (param, value) => {
      const res = await request(app).get(`/api/products/search?${param}=${value}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_FILTER');
      expect(mockSearchPaged).not.toHaveBeenCalled();
    }
  );

  it('treats an empty-string idCategory/idFranchise as "no filter", not a 400', async () => {
    mockSearchPaged.mockResolvedValue({ products: [], total: 0 });

    const res = await request(app).get('/api/products/search?idCategory=&idFranchise=');

    expect(res.status).toBe(200);
    expect(mockSearchPaged).toHaveBeenCalledWith(
      expect.objectContaining({ idCategory: undefined, idFranchise: undefined })
    );
  });

  it('trusts the repository for deterministic idProduct ASC ordering (pass-through, no reordering in the wiring layer)', async () => {
    mockSearchPaged.mockResolvedValue({ products: [makeProduct(3), makeProduct(9), makeProduct(15)], total: 3 });

    const res = await request(app).get('/api/products/search');

    expect(res.body.products.map((p: { idProduct: number }) => p.idProduct)).toEqual([3, 9, 15]);
  });

  it('returns the paginated page envelope, not a single product (route reaches search, not show)', async () => {
    mockSearchPaged.mockResolvedValue({ products: [makeProduct(1)], total: 1 });

    const res = await request(app).get('/api/products/search?search=goku');

    expect(res.body).toEqual(
      expect.objectContaining({ page: 1, pageSize: 20, total: 1, totalPages: 1, products: expect.any(Array) })
    );
  });
});
