import { DeleteProductUseCase } from '../use-cases/DeleteProductUseCase';
import { IProductRepository } from '../../domain/ports/IProductRepository';

describe('DeleteProductUseCase', () => {
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let useCase: DeleteProductUseCase;

  beforeEach(() => {
    mockProductRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findLatest: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IProductRepository>;

    useCase = new DeleteProductUseCase(mockProductRepo);
  });

  it('should call delete on repository and return true if successful', async () => {
    mockProductRepo.delete.mockResolvedValue(true);

    const result = await useCase.execute(5);

    expect(result).toBe(true);
    expect(mockProductRepo.delete).toHaveBeenCalledWith(5);
  });

  it('should call delete on repository and return false if unsuccessful', async () => {
    mockProductRepo.delete.mockResolvedValue(false);

    const result = await useCase.execute(999);

    expect(result).toBe(false);
    expect(mockProductRepo.delete).toHaveBeenCalledWith(999);
  });
});
