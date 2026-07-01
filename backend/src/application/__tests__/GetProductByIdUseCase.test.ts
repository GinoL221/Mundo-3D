import { GetProductByIdUseCase } from '../use-cases/GetProductByIdUseCase';
import { IProductRepository } from '../../domain/ports/IProductRepository';
import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';

describe('GetProductByIdUseCase', () => {
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let useCase: GetProductByIdUseCase;

  beforeEach(() => {
    mockProductRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findLatest: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IProductRepository>;

    useCase = new GetProductByIdUseCase(mockProductRepo);
  });

  it('should return ProductDTO if product is found', async () => {
    const cat = new Category(1, 'Figures');
    const product = new Product(1, 'Product A', 50, 'Desc A', 'a.jpg', 1, 10, cat);

    mockProductRepo.findById.mockResolvedValue(product);

    const result = await useCase.execute(1);

    expect(result).toEqual({
      idProduct: 1,
      nameProduct: 'Product A',
      price: 50,
      descriptionProduct: 'Desc A',
      image: 'a.jpg',
      idCategory: 1,
      idFranchise: 10,
      category: 'Figures',
      material: null,
      height: null,
      width: null,
      depth: null,
      finish: null,
      productionTime: null,
    });
    expect(mockProductRepo.findById).toHaveBeenCalledWith(1);
  });

  it('should throw an error if product is not found', async () => {
    mockProductRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow('Product not found');
    expect(mockProductRepo.findById).toHaveBeenCalledWith(999);
  });
});
