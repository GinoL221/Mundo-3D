import { DeleteCategoryUseCase } from '../use-cases/DeleteCategoryUseCase';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';

describe('DeleteCategoryUseCase', () => {
  let mockCategoryRepo: jest.Mocked<ICategoryRepository>;
  let useCase: DeleteCategoryUseCase;

  beforeEach(() => {
    mockCategoryRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ICategoryRepository>;

    useCase = new DeleteCategoryUseCase(mockCategoryRepo);
  });

  it('should call delete on the repository and return true if successful', async () => {
    mockCategoryRepo.delete.mockResolvedValue(true);

    const result = await useCase.execute(1);

    expect(result).toBe(true);
    expect(mockCategoryRepo.delete).toHaveBeenCalledWith(1);
  });

  it('should call delete on the repository and return false if unsuccessful', async () => {
    mockCategoryRepo.delete.mockResolvedValue(false);

    const result = await useCase.execute(999);

    expect(result).toBe(false);
    expect(mockCategoryRepo.delete).toHaveBeenCalledWith(999);
  });

  it('should propagate a repository error (e.g. FK violation translated by the adapter)', async () => {
    mockCategoryRepo.delete.mockRejectedValue(new Error('Category has associated products'));

    await expect(useCase.execute(2)).rejects.toThrow('Category has associated products');
  });
});
