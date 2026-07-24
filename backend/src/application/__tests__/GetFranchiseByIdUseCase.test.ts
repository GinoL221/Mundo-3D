import { GetFranchiseByIdUseCase } from '../use-cases/GetFranchiseByIdUseCase';
import { FranchiseRepositoryPort } from '../../domain/ports/FranchiseRepositoryPort';
import { Franchise } from '../../domain/entities/Franchise';

describe('GetFranchiseByIdUseCase', () => {
  let franchiseRepo: jest.Mocked<FranchiseRepositoryPort>;
  let useCase: GetFranchiseByIdUseCase;

  beforeEach(() => {
    franchiseRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<FranchiseRepositoryPort>;

    useCase = new GetFranchiseByIdUseCase(franchiseRepo);
  });

  it('returns a FranchiseDTO when the franchise exists', async () => {
    franchiseRepo.findById.mockResolvedValue(new Franchise(1, 'Studio Ghibli'));

    await expect(useCase.execute(1)).resolves.toEqual({
      idFranchise: 1,
      nameFranchise: 'Studio Ghibli',
    });
    expect(franchiseRepo.findById).toHaveBeenCalledWith(1);
  });

  it('throws the domain not-found error when the franchise does not exist', async () => {
    franchiseRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow('Franchise not found');
    expect(franchiseRepo.findById).toHaveBeenCalledWith(999);
  });
});
