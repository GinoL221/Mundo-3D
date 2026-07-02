import { AdjustProductStockUseCase } from '../use-cases/AdjustProductStockUseCase';
import { IProductRepository } from '../../domain/ports/IProductRepository';
import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';

describe('AdjustProductStockUseCase', () => {
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let useCase: AdjustProductStockUseCase;

  beforeEach(() => {
    mockProductRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findLatest: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      adjustStock: jest.fn(),
    } as unknown as jest.Mocked<IProductRepository>;

    useCase = new AdjustProductStockUseCase(mockProductRepo);
  });

  it('increases stock and maps the updated product to a ProductDTO on a valid positive delta', async () => {
    const category = new Category(1, 'Figures');
    const updated = new Product(10, 'Product A', 100, 'Desc', 'a.jpg', 1, 2, category, undefined, null, null, null, null, null, null, 8);
    mockProductRepo.adjustStock.mockResolvedValue(updated);

    const result = await useCase.execute(10, 3);

    expect(mockProductRepo.adjustStock).toHaveBeenCalledWith(10, 3);
    expect(result).toEqual({
      idProduct: 10,
      nameProduct: 'Product A',
      price: 100,
      descriptionProduct: 'Desc',
      image: 'a.jpg',
      idCategory: 1,
      idFranchise: 2,
      category: 'Figures',
      material: null,
      height: null,
      width: null,
      depth: null,
      finish: null,
      productionTime: null,
      stock: 8,
    });
  });

  it('decreases stock on a valid negative delta', async () => {
    const updated = new Product(10, 'Product A', 100, 'Desc', 'a.jpg', 1, 2, undefined, undefined, null, null, null, null, null, null, 3);
    mockProductRepo.adjustStock.mockResolvedValue(updated);

    const result = await useCase.execute(10, -2);

    expect(mockProductRepo.adjustStock).toHaveBeenCalledWith(10, -2);
    expect(result?.stock).toBe(3);
  });

  it('returns null when the product does not exist', async () => {
    mockProductRepo.adjustStock.mockResolvedValue(null);

    const result = await useCase.execute(999, 1);

    expect(result).toBeNull();
  });

  it('propagates the "Insufficient stock" error thrown by the repository when the delta would go negative', async () => {
    mockProductRepo.adjustStock.mockRejectedValue(new Error('Insufficient stock'));

    await expect(useCase.execute(10, -5)).rejects.toThrow('Insufficient stock');
  });

  it('propagates the "Delta must be a non-zero integer" error thrown by the repository for a zero or non-integer delta', async () => {
    mockProductRepo.adjustStock.mockRejectedValue(new Error('Delta must be a non-zero integer'));

    await expect(useCase.execute(10, 0)).rejects.toThrow('Delta must be a non-zero integer');
  });
});
