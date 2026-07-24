import { CreateFranchiseUseCase, CreateFranchiseInput } from '../use-cases/CreateFranchiseUseCase';
import { FranchiseRepositoryPort } from '../../domain/ports/FranchiseRepositoryPort';
import { Franchise } from '../../domain/entities/Franchise';

describe('CreateFranchiseUseCase', () => {
  let franchiseRepo: jest.Mocked<FranchiseRepositoryPort>;
  let useCase: CreateFranchiseUseCase;

  beforeEach(() => {
    franchiseRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<FranchiseRepositoryPort>;

    useCase = new CreateFranchiseUseCase(franchiseRepo);
  });

  it('creates a franchise and returns its DTO', async () => {
    const input: CreateFranchiseInput = { nameFranchise: 'Studio Ghibli' };
    franchiseRepo.create.mockResolvedValue(new Franchise(1, 'Studio Ghibli'));

    await expect(useCase.execute(input)).resolves.toEqual({
      idFranchise: 1,
      nameFranchise: 'Studio Ghibli',
    });
    expect(franchiseRepo.create).toHaveBeenCalledWith({ nameFranchise: 'Studio Ghibli' });
  });

  it('maps the repository-created franchise rather than the input identifier', async () => {
    const input: CreateFranchiseInput = { nameFranchise: 'Marvel' };
    franchiseRepo.create.mockResolvedValue(new Franchise(8, 'Marvel'));

    await expect(useCase.execute(input)).resolves.toEqual({
      idFranchise: 8,
      nameFranchise: 'Marvel',
    });
  });
});
