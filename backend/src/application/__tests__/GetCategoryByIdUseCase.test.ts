import { GetCategoryByIdUseCase } from '../use-cases/GetCategoryByIdUseCase';
import { CategoryRepositoryPort } from '../../domain/ports/CategoryRepositoryPort';
import { Category } from '../../domain/entities/Category';

describe('GetCategoryByIdUseCase', () => {
  let mockCategoryRepo: jest.Mocked<CategoryRepositoryPort>;
  let useCase: GetCategoryByIdUseCase;

  beforeEach(() => {
    mockCategoryRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CategoryRepositoryPort>;

    useCase = new GetCategoryByIdUseCase(mockCategoryRepo);
  });

  it('should return a CategoryDTO when the category is found', async () => {
    const category = new Category(1, 'Figures');
    mockCategoryRepo.findById.mockResolvedValue(category);

    const result = await useCase.execute(1);

    expect(result).toEqual({ idCategory: 1, nameCategory: 'Figures' });
    expect(mockCategoryRepo.findById).toHaveBeenCalledWith(1);
  });

  it('should throw "Category not found" when the category does not exist', async () => {
    mockCategoryRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow('Category not found');
    expect(mockCategoryRepo.findById).toHaveBeenCalledWith(999);
  });
});
