import { GetLatestProductUseCase } from '../use-cases/GetLatestProductUseCase';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';

describe('GetLatestProductUseCase', () => {
  let mockProductRepo: jest.Mocked<ProductRepositoryPort>;
  let useCase: GetLatestProductUseCase;

  beforeEach(() => {
    mockProductRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findLatest: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ProductRepositoryPort>;

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
      idProduct: 10,
      nameProduct: 'Latest Figures',
      price: 120,
      descriptionProduct: 'Awesome figures',
      image: 'fig.jpg',
      idCategory: 2,
      idFranchise: 5,
      category: 'Figures',
      material: null,
      height: null,
      width: null,
      depth: null,
      finish: null,
      productionTime: null,
      stock: 0,
    });
    expect(mockProductRepo.findLatest).toHaveBeenCalledTimes(1);
  });

  it('should handle product without category gracefully', async () => {
    const product = new Product(10, 'Latest Figures', 120, 'Awesome figures', 'fig.jpg', 2, 5);
    mockProductRepo.findLatest.mockResolvedValue(product);

    const result = await useCase.execute();

    expect(result.category).toBe('Sin categoría');
  });
});
