import { UpdateCategoryUseCase, UpdateCategoryInput } from '../use-cases/UpdateCategoryUseCase';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import { Category } from '../../domain/entities/Category';

describe('UpdateCategoryUseCase', () => {
  let mockCategoryRepo: jest.Mocked<ICategoryRepository>;
  let useCase: UpdateCategoryUseCase;

  beforeEach(() => {
    mockCategoryRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ICategoryRepository>;

    useCase = new UpdateCategoryUseCase(mockCategoryRepo);
  });

  it('should update the category and return the updated CategoryDTO', async () => {
    const input: UpdateCategoryInput = { nameCategory: 'Updated Figures' };
    const updatedCategory = new Category(1, 'Updated Figures');
    mockCategoryRepo.update.mockResolvedValue(updatedCategory);

    const result = await useCase.execute(1, input);

    expect(result).toEqual({ idCategory: 1, nameCategory: 'Updated Figures' });
    expect(mockCategoryRepo.update).toHaveBeenCalledWith(1, input);
  });

  it('should return null when the category to update does not exist', async () => {
    mockCategoryRepo.update.mockResolvedValue(null);

    const result = await useCase.execute(999, { nameCategory: 'Nonexistent' });

    expect(result).toBeNull();
    expect(mockCategoryRepo.update).toHaveBeenCalledWith(999, { nameCategory: 'Nonexistent' });
  });
});
