import { SearchProductsUseCase, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../use-cases/SearchProductsUseCase';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';
import { Franchise } from '../../domain/entities/Franchise';

function makeProduct(idProduct: number, overrides: Partial<{ category: Category }> = {}): Product {
  return new Product(
    idProduct,
    `Product ${idProduct}`,
    100,
    'A description',
    'image.png',
    1,
    2,
    overrides.category ?? new Category(1, 'Figuras'),
    new Franchise(2, 'Dragon Ball'),
    'PLA',
    10,
    5,
    5,
    'Mate',
    3,
    7
  );
}

describe('SearchProductsUseCase', () => {
  let productRepo: jest.Mocked<ProductRepositoryPort>;
  let useCase: SearchProductsUseCase;

  beforeEach(() => {
    productRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findLatest: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      adjustStock: jest.fn(),
      searchPaged: jest.fn(),
    };
    useCase = new SearchProductsUseCase(productRepo);
  });

  it('exposes DEFAULT_PAGE_SIZE=20 and MAX_PAGE_SIZE=50 as its own constants', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(MAX_PAGE_SIZE).toBe(50);
  });

  it('computes offset as (page - 1) * pageSize for the first page', async () => {
    productRepo.searchPaged.mockResolvedValue({ products: [], total: 0 });

    await useCase.execute({ page: 1, pageSize: 20 });

    expect(productRepo.searchPaged).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 })
    );
  });

  it('computes offset for a later page', async () => {
    productRepo.searchPaged.mockResolvedValue({ products: [], total: 0 });

    await useCase.execute({ page: 3, pageSize: 10 });

    expect(productRepo.searchPaged).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 })
    );
  });

  it('trims a search term and forwards idCategory/idFranchise untouched', async () => {
    productRepo.searchPaged.mockResolvedValue({ products: [], total: 0 });

    await useCase.execute({ search: '  goku  ', idCategory: 3, idFranchise: 5, page: 1, pageSize: 20 });

    expect(productRepo.searchPaged).toHaveBeenCalledWith({
      search: 'goku',
      idCategory: 3,
      idFranchise: 5,
      limit: 20,
      offset: 0,
    });
  });

  it('treats a blank/whitespace-only search as absent (undefined)', async () => {
    productRepo.searchPaged.mockResolvedValue({ products: [], total: 0 });

    await useCase.execute({ search: '   ', page: 1, pageSize: 20 });

    expect(productRepo.searchPaged).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined })
    );
  });

  it('treats an omitted search as absent (undefined)', async () => {
    productRepo.searchPaged.mockResolvedValue({ products: [], total: 0 });

    await useCase.execute({ page: 1, pageSize: 20 });

    expect(productRepo.searchPaged).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined })
    );
  });

  it('computes totalPages from total/pageSize', async () => {
    productRepo.searchPaged.mockResolvedValue({ products: [], total: 37 });

    const result = await useCase.execute({ page: 1, pageSize: 20 });

    expect(result.total).toBe(37);
    expect(result.totalPages).toBe(2);
  });

  it('returns totalPages: 0 when total is 0 (never 0/pageSize -> 0 by coincidence only)', async () => {
    productRepo.searchPaged.mockResolvedValue({ products: [], total: 0 });

    const result = await useCase.execute({ page: 1, pageSize: 20 });

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.products).toEqual([]);
  });

  it('echoes page and pageSize back on the page DTO', async () => {
    productRepo.searchPaged.mockResolvedValue({ products: [], total: 0 });

    const result = await useCase.execute({ page: 4, pageSize: 10 });

    expect(result.page).toBe(4);
    expect(result.pageSize).toBe(10);
  });

  it('trusts an already-validated pageSize with no defensive clamping', async () => {
    productRepo.searchPaged.mockResolvedValue({ products: [], total: 0 });

    // 999 would be rejected by the HTTP validator upstream — the use case
    // itself must not silently clamp it.
    await useCase.execute({ page: 1, pageSize: 999 });

    expect(productRepo.searchPaged).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 999 })
    );
  });

  it('maps products to the existing ProductDTO shape, matching ListProductsUseCase', async () => {
    const product = makeProduct(10);
    productRepo.searchPaged.mockResolvedValue({ products: [product], total: 1 });

    const result = await useCase.execute({ page: 1, pageSize: 20 });

    expect(result.products[0]).toEqual({
      idProduct: 10,
      nameProduct: 'Product 10',
      price: 100,
      descriptionProduct: 'A description',
      image: 'image.png',
      idCategory: 1,
      idFranchise: 2,
      category: 'Figuras',
      material: 'PLA',
      height: 10,
      width: 5,
      depth: 5,
      finish: 'Mate',
      productionTime: 3,
      stock: 7,
    });
  });

  it("falls back category to 'Sin categoría' when the product has no Category", async () => {
    const product = new Product(11, 'Product 11', 50, null, null, 1, 2, undefined, undefined);
    productRepo.searchPaged.mockResolvedValue({ products: [product], total: 1 });

    const result = await useCase.execute({ page: 1, pageSize: 20 });

    expect(result.products[0].category).toBe('Sin categoría');
  });

  it('falls back stock to 0 when the product has no stock', async () => {
    const product = new Product(12, 'Product 12', 50, null, null, 1, 2, undefined, undefined);
    productRepo.searchPaged.mockResolvedValue({ products: [product], total: 1 });

    const result = await useCase.execute({ page: 1, pageSize: 20 });

    expect(result.products[0].stock).toBe(0);
  });
});
