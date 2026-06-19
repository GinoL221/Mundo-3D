import { GetLatestProductUseCase } from '../use-cases/GetLatestProductUseCase';
import { IProductRepository } from '../../domain/ports/IProductRepository';
import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';

describe('GetLatestProductUseCase', () => {
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let useCase: GetLatestProductUseCase;

  beforeEach(() => {
    mockProductRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findLatest: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IProductRepository>;

    useCase = new GetLatestProductUseCase(mockProductRepo);
  });

  it('should throw an error when no products exist', async () => {
    mockProductRepo.findLatest.mockResolvedValue(null);

    await expect(useCase.execute()).rejects.toThrow('Product not found');
    expect(mockProductRepo.findLatest).toHaveBeenCalledTimes(1);
  });

  it('should fetch the latest product and map to ProductDTO', async () => {
    const category = new Category(2, 'Figures');
    const product = new Product(10, 'Latest Figures', 120, 'Awesome figures', 'fig.jpg', 2, 5, category);
    mockProductRepo.findLatest.mockResolvedValue(product);

    const result = await useCase.execute();

    expect(result).toEqual({
      IDProduct: 10,
      NameProduct: 'Latest Figures',
      Price: 120,
      DescriptionProduct: 'Awesome figures',
      Image: 'fig.jpg',
      IDCategory: 2,
      IDFranchise: 5,
      Category: 'Figures',
    });
    expect(mockProductRepo.findLatest).toHaveBeenCalledTimes(1);
  });

  it('should handle product without category gracefully', async () => {
    const product = new Product(10, 'Latest Figures', 120, 'Awesome figures', 'fig.jpg', 2, 5);
    mockProductRepo.findLatest.mockResolvedValue(product);

    const result = await useCase.execute();

    expect(result.Category).toBe('Sin categoría');
  });
});
