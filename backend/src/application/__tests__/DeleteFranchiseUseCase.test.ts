import { DeleteFranchiseUseCase } from '../use-cases/DeleteFranchiseUseCase';
import { IFranchiseRepository } from '../../domain/ports/IFranchiseRepository';

describe('DeleteFranchiseUseCase', () => {
  let franchiseRepo: jest.Mocked<IFranchiseRepository>;
  let useCase: DeleteFranchiseUseCase;

  beforeEach(() => {
    franchiseRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IFranchiseRepository>;

    useCase = new DeleteFranchiseUseCase(franchiseRepo);
  });

  it('returns true when the repository deletes the franchise', async () => {
    franchiseRepo.delete.mockResolvedValue(true);

    await expect(useCase.execute(1)).resolves.toBe(true);
    expect(franchiseRepo.delete).toHaveBeenCalledWith(1);
  });

  it('returns false when the repository cannot find the franchise', async () => {
    franchiseRepo.delete.mockResolvedValue(false);

    await expect(useCase.execute(999)).resolves.toBe(false);
    expect(franchiseRepo.delete).toHaveBeenCalledWith(999);
  });

  it('propagates a translated referential-integrity error from the repository', async () => {
    franchiseRepo.delete.mockRejectedValue(new Error('Franchise has associated products'));

    await expect(useCase.execute(1)).rejects.toThrow('Franchise has associated products');
  });
});
