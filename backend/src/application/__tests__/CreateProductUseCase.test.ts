import { CreateProductUseCase, CreateProductInput } from '../use-cases/CreateProductUseCase';
import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';

describe('CreateProductUseCase', () => {
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let mockCategoryRepo: jest.Mocked<ICategoryRepository>;
  let useCase: CreateProductUseCase;

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

    useCase = new CreateProductUseCase(mockProductRepo, mockCategoryRepo);
  });

  it('should create a product and map it to a ProductDTO with fetched Category name', async () => {
    const input: CreateProductInput = {
      nameProduct: 'New Product',
      price: 100,
      descriptionProduct: 'Brand new',
      image: 'new.jpg',
      idCategory: 1,
      idFranchise: 2,
    };

    const createdProduct = new Product(10, 'New Product', 100, 'Brand new', 'new.jpg', 1, 2);
    const mockCategory = new Category(1, 'Figures');

    mockProductRepo.create.mockResolvedValue(createdProduct);
    mockCategoryRepo.findById.mockResolvedValue(mockCategory);

    const result = await useCase.execute(input);

    expect(result).toEqual({
      idProduct: 10,
      nameProduct: 'New Product',
      price: 100,
      descriptionProduct: 'Brand new',
      image: 'new.jpg',
      idCategory: 1,
      idFranchise: 2,
      category: 'Figures',
      material: null,
      height: null,
      width: null,
      depth: null,
      finish: null,
      productionTime: null,
    });

    expect(mockProductRepo.create).toHaveBeenCalledWith({
      nameProduct: input.nameProduct,
      price: input.price,
      descriptionProduct: input.descriptionProduct,
      image: input.image,
      idCategory: input.idCategory,
      idFranchise: input.idFranchise,
      material: null,
      height: null,
      width: null,
      depth: null,
      finish: null,
      productionTime: null,
    });
    expect(mockCategoryRepo.findById).toHaveBeenCalledWith(1);
  });

  it('should use Category name from relation if already populated', async () => {
    const input: CreateProductInput = {
      nameProduct: 'New Product',
      price: 100,
      descriptionProduct: 'Brand new',
      image: 'new.jpg',
      idCategory: 1,
      idFranchise: 2,
    };

    const mockCategory = new Category(1, 'Figures');
    const createdProduct = new Product(10, 'New Product', 100, 'Brand new', 'new.jpg', 1, 2, mockCategory);

    mockProductRepo.create.mockResolvedValue(createdProduct);

    const result = await useCase.execute(input);

    expect(result.category).toBe('Figures');
    expect(mockCategoryRepo.findById).not.toHaveBeenCalled();
  });

  it('should fallback to Sin categoría if Category is not found', async () => {
    const input: CreateProductInput = {
      nameProduct: 'New Product',
      price: 100,
      descriptionProduct: 'Brand new',
      image: 'new.jpg',
      idCategory: 999,
      idFranchise: 2,
    };

    const createdProduct = new Product(10, 'New Product', 100, 'Brand new', 'new.jpg', 999, 2);

    mockProductRepo.create.mockResolvedValue(createdProduct);
    mockCategoryRepo.findById.mockResolvedValue(null);

    const result = await useCase.execute(input);

    expect(result.category).toBe('Sin categoría');
  });
});
