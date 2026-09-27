import { CreateCustomCommissionRequestUseCase } from '../use-cases/CreateCustomCommissionRequestUseCase';
import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';
import { CustomCommissionRequest } from '../../domain/entities/CustomCommissionRequest';

describe('CreateCustomCommissionRequestUseCase', () => {
  it('sets expiresAt exactly 30 days after the injected creation time', async () => {
    const now = new Date('2026-09-01T12:34:56.789Z');
    const repo: jest.Mocked<CustomCommissionRequestRepositoryPort> = {
      create: jest.fn(async (request) => new CustomCommissionRequest(4, request.name, request.email, request.idea, request.idProduct, request.createdAt, request.expiresAt)),
      listActive: jest.fn(),
      purgeExpired: jest.fn(),
    };
    const useCase = new CreateCustomCommissionRequestUseCase(repo, () => now);

    const result = await useCase.execute({ name: 'Ari', email: 'ari@example.com', idea: 'A dragon', idProduct: null });

    expect(result.createdAt).toBe(now);
    expect(result.expiresAt.getTime()).toBe(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ idProduct: null }));
  });

  it('stores null when no product reference is provided', async () => {
    const repo = {
      create: jest.fn(async (request: any) => new CustomCommissionRequest(5, request.name, request.email, request.idea, request.idProduct, request.createdAt, request.expiresAt)),
      listActive: jest.fn(),
      purgeExpired: jest.fn(),
    } as unknown as jest.Mocked<CustomCommissionRequestRepositoryPort>;
    const useCase = new CreateCustomCommissionRequestUseCase(repo, () => new Date('2026-09-01T00:00:00Z'));
    const result = await useCase.execute({ name: 'Sam', email: 'sam@example.com', idea: 'A comet' });
    expect(result.idProduct).toBeNull();
  });
});
