import { ListFranchisesUseCase } from '../use-cases/ListFranchisesUseCase';
import { IFranchiseRepository } from '../../domain/ports/IFranchiseRepository';
import { Franchise } from '../../domain/entities/Franchise';

describe('ListFranchisesUseCase', () => {
  let franchiseRepo: jest.Mocked<IFranchiseRepository>;
  let useCase: ListFranchisesUseCase;

  beforeEach(() => {
    franchiseRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IFranchiseRepository>;

    useCase = new ListFranchisesUseCase(franchiseRepo);
  });

  it('returns an empty DTO list when the repository has no franchises', async () => {
    franchiseRepo.findAll.mockResolvedValue([]);

    await expect(useCase.execute()).resolves.toEqual([]);
    expect(franchiseRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it('maps each franchise entity to a FranchiseDTO', async () => {
    franchiseRepo.findAll.mockResolvedValue([
      new Franchise(1, 'Studio Ghibli'),
      new Franchise(2, 'Marvel'),
    ]);

    await expect(useCase.execute()).resolves.toEqual([
      { idFranchise: 1, nameFranchise: 'Studio Ghibli' },
      { idFranchise: 2, nameFranchise: 'Marvel' },
    ]);
  });
});
