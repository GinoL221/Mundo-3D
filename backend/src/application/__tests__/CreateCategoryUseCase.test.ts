import { CreateCategoryUseCase, CreateCategoryInput } from '../use-cases/CreateCategoryUseCase';
import { CategoryRepositoryPort } from '../../domain/ports/CategoryRepositoryPort';
import { Category } from '../../domain/entities/Category';

describe('CreateCategoryUseCase', () => {
  let mockCategoryRepo: jest.Mocked<CategoryRepositoryPort>;
  let useCase: CreateCategoryUseCase;

  beforeEach(() => {
    mockCategoryRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CategoryRepositoryPort>;

    useCase = new CreateCategoryUseCase(mockCategoryRepo);
  });

  it('should create a category and return the created CategoryDTO', async () => {
    const input: CreateCategoryInput = { nameCategory: 'Figures' };
    const createdCategory = new Category(1, 'Figures');
    mockCategoryRepo.create.mockResolvedValue(createdCategory);

    const result = await useCase.execute(input);

    expect(result).toEqual({ idCategory: 1, nameCategory: 'Figures' });
    expect(mockCategoryRepo.create).toHaveBeenCalledWith({ nameCategory: 'Figures' });
  });

  it('should propagate a different created category name into the DTO', async () => {
    const input: CreateCategoryInput = { nameCategory: 'Decorations' };
    const createdCategory = new Category(2, 'Decorations');
    mockCategoryRepo.create.mockResolvedValue(createdCategory);

    const result = await useCase.execute(input);

    expect(result).toEqual({ idCategory: 2, nameCategory: 'Decorations' });
    expect(mockCategoryRepo.create).toHaveBeenCalledWith({ nameCategory: 'Decorations' });
  });
});
