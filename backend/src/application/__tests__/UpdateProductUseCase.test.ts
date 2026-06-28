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
    const updatedProduct = new Product(10, 'Updated Product', 150, 'Desc', 'img.jpg', 1, 2, mockCategory);

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
    });

    expect(mockProductRepo.update).toHaveBeenCalledWith(10, input);
  });

  it('should return null if the product does not exist', async () => {
    mockProductRepo.update.mockResolvedValue(null);

    const result = await useCase.execute(999, { nameProduct: 'Nonexistent' });

    expect(result).toBeNull();
    expect(mockProductRepo.update).toHaveBeenCalledWith(999, { nameProduct: 'Nonexistent' });
  });
});
