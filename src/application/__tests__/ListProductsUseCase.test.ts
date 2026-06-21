import { ListProductsUseCase } from '../use-cases/ListProductsUseCase';
import { IProductRepository } from '../../domain/ports/IProductRepository';
import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';

describe('ListProductsUseCase', () => {
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let useCase: ListProductsUseCase;

  beforeEach(() => {
    mockProductRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findLatest: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IProductRepository>;

    useCase = new ListProductsUseCase(mockProductRepo);
  });

  it('should return empty list when repository returns empty array', async () => {
    mockProductRepo.findAll.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual({
      count: 0,
      products: [],
      countByCategory: {},
    });
    expect(mockProductRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it('should list products and map them with categories and count counters', async () => {
    const cat1 = new Category(1, 'Figures');
    const cat2 = new Category(2, 'Decorations');

    const products = [
      new Product(1, 'Product A', 50, 'Desc A', 'a.jpg', 1, 10, cat1),
      new Product(2, 'Product B', 30, 'Desc B', 'b.jpg', 1, 10, cat1),
      new Product(3, 'Product C', 20, 'Desc C', 'c.jpg', 2, 20, cat2),
    ];

    mockProductRepo.findAll.mockResolvedValue(products);

    const result = await useCase.execute();

    expect(result.count).toBe(3);
    expect(result.products).toHaveLength(3);
    expect(result.products[0]).toEqual({
      idProduct: 1,
      nameProduct: 'Product A',
      price: 50,
      descriptionProduct: 'Desc A',
      image: 'a.jpg',
      idCategory: 1,
      idFranchise: 10,
      Category: 'Figures',
    });

    expect(result.countByCategory['Figures'].count).toBe(2);
    expect(result.countByCategory['Figures'].category).toEqual({
      idCategory: 1,
    });

    expect(result.countByCategory['Decorations'].count).toBe(1);
    expect(result.countByCategory['Decorations'].category).toEqual({
      idCategory: 2,
    });
  });

  it('should handle products without category', async () => {
    const products = [
      new Product(1, 'No Cat Product', 15, 'No category', 'x.jpg', 99, 99),
    ];

    mockProductRepo.findAll.mockResolvedValue(products);

    const result = await useCase.execute();

    expect(result.count).toBe(1);
    expect(result.products[0].Category).toBe('Sin categoría');
    expect(result.countByCategory['Sin categoría'].count).toBe(1);
    expect(result.countByCategory['Sin categoría'].category).toBeNull();
  });
});
