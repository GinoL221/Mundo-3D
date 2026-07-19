import { UpdateFranchiseUseCase, UpdateFranchiseInput } from '../use-cases/UpdateFranchiseUseCase';
import { IFranchiseRepository } from '../../domain/ports/IFranchiseRepository';
import { Franchise } from '../../domain/entities/Franchise';

describe('UpdateFranchiseUseCase', () => {
  let franchiseRepo: jest.Mocked<IFranchiseRepository>;
  let useCase: UpdateFranchiseUseCase;

  beforeEach(() => {
    franchiseRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IFranchiseRepository>;

    useCase = new UpdateFranchiseUseCase(franchiseRepo);
  });

  it('returns the updated FranchiseDTO', async () => {
    const input: UpdateFranchiseInput = { nameFranchise: 'Marvel Studios' };
    franchiseRepo.update.mockResolvedValue(new Franchise(1, 'Marvel Studios'));

    await expect(useCase.execute(1, input)).resolves.toEqual({
      idFranchise: 1,
      nameFranchise: 'Marvel Studios',
    });
    expect(franchiseRepo.update).toHaveBeenCalledWith(1, input);
  });

  it('returns null when the franchise cannot be updated because it does not exist', async () => {
    franchiseRepo.update.mockResolvedValue(null);

    await expect(useCase.execute(999, { nameFranchise: 'Unknown' })).resolves.toBeNull();
    expect(franchiseRepo.update).toHaveBeenCalledWith(999, { nameFranchise: 'Unknown' });
  });
});
