import { UpdateProductUseCase, UpdateProductInput } from '../use-cases/UpdateProductUseCase';
import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';

describe('UpdateProductUseCase', () => {
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let mockCategoryRepo: jest.Mocked<ICategoryRepository>;
  let useCase: UpdateProductUseCase;

  beforeEach(() => {
    mockProductRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findLatest: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IProductRepository>;

    mockCategoryRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ICategoryRepository>;

    useCase = new UpdateProductUseCase(mockProductRepo, mockCategoryRepo);
  });

  it('should update the product and map it to a ProductDTO', async () => {
    const input: UpdateProductInput = {
      nameProduct: 'Updated Product',
      price: 150,
    };

    const mockCategory = new Category(1, 'Figures');
    const updatedProduct = new Product(10, 'Updated Product', 150, 'Desc', 'img.jpg', 1, 2, mockCategory, undefined, null, null, null, null, null, null, 7);

    mockProductRepo.update.mockResolvedValue(updatedProduct);

    const result = await useCase.execute(10, input);

    expect(result).toEqual({
      idProduct: 10,
      nameProduct: 'Updated Product',
      price: 150,
      descriptionProduct: 'Desc',
      image: 'img.jpg',
      idCategory: 1,
      idFranchise: 2,
      category: 'Figures',
      material: null,
      height: null,
      width: null,
      depth: null,
      finish: null,
      productionTime: null,
      stock: 7,
    });

    expect(mockProductRepo.update).toHaveBeenCalledWith(10, input);
  });

  it('should return null if the product does not exist', async () => {
    mockProductRepo.update.mockResolvedValue(null);

    const result = await useCase.execute(999, { nameProduct: 'Nonexistent' });

    expect(result).toBeNull();
    expect(mockProductRepo.update).toHaveBeenCalledWith(999, { nameProduct: 'Nonexistent' });
  });

  it('should not accept a stock override: the returned stock always comes from the repository result, never from the input', async () => {
    // `stock` is not part of `UpdateProductInput` at the type level (compile-time
    // enforcement lives in IProductRepository.update()'s `Omit<Partial<Product>, 'stock'>`
    // signature). This test proves the runtime behavior: even if a caller smuggles a
    // `stock` value into the input via an unsafe cast, the use case's output DTO reflects
    // only what the repository actually persisted/returned — never the attempted input value.
    const maliciousInput = { nameProduct: 'Updated Product', stock: 999 } as unknown as UpdateProductInput;
    const updatedProduct = new Product(10, 'Updated Product', 150, 'Desc', 'img.jpg', 1, 2, undefined, undefined, null, null, null, null, null, null, 3);

    mockProductRepo.update.mockResolvedValue(updatedProduct);

    const result = await useCase.execute(10, maliciousInput);

    expect(result?.stock).toBe(3);
    expect(result?.stock).not.toBe(999);
  });
});
