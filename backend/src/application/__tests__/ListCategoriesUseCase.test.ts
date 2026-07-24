import { ListCategoriesUseCase } from '../use-cases/ListCategoriesUseCase';
import { CategoryRepositoryPort } from '../../domain/ports/CategoryRepositoryPort';
import { Category } from '../../domain/entities/Category';

describe('ListCategoriesUseCase', () => {
  let mockCategoryRepo: jest.Mocked<CategoryRepositoryPort>;
  let useCase: ListCategoriesUseCase;

  beforeEach(() => {
    mockCategoryRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CategoryRepositoryPort>;

    useCase = new ListCategoriesUseCase(mockCategoryRepo);
  });

  it('should return an empty array when the repository has no categories', async () => {
    mockCategoryRepo.findAll.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual([]);
    expect(mockCategoryRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it('should return a list of CategoryDTO mapped from domain entities', async () => {
    const categories = [new Category(1, 'Figures'), new Category(2, 'Decorations')];
    mockCategoryRepo.findAll.mockResolvedValue(categories);

    const result = await useCase.execute();

    expect(result).toEqual([
      { idCategory: 1, nameCategory: 'Figures' },
      { idCategory: 2, nameCategory: 'Decorations' },
    ]);
  });
});
