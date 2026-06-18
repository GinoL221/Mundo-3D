import { GetCartDistinctCountUseCase } from '../use-cases/GetCartDistinctCountUseCase';
import { IShoppingCartRepository } from '../../domain/ports/IShoppingCartRepository';

describe('GetCartDistinctCountUseCase', () => {
  let repositoryMock: jest.Mocked<IShoppingCartRepository>;
  let useCase: GetCartDistinctCountUseCase;

  beforeEach(() => {
    repositoryMock = {
      findByUserId: jest.fn(),
      getDistinctCount: jest.fn(),
    };
    useCase = new GetCartDistinctCountUseCase(repositoryMock);
  });

  it('should call repository.getDistinctCount and return the count', async () => {
    repositoryMock.getDistinctCount.mockResolvedValue(5);

    const result = await useCase.execute(42);

    expect(repositoryMock.getDistinctCount).toHaveBeenCalledWith(42);
    expect(result).toBe(5);
  });
});
