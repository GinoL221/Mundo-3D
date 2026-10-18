import { CreateCustomCommissionRequestUseCase } from '../use-cases/CreateCustomCommissionRequestUseCase';
import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { CustomCommissionRequest } from '../../domain/entities/CustomCommissionRequest';
import { SelectedProductNotFoundException } from '../../domain/exceptions/SelectedProductNotFoundException';

describe('CreateCustomCommissionRequestUseCase', () => {
  it('sets expiresAt exactly 30 days after the injected creation time', async () => {
    const now = new Date('2026-09-01T12:34:56.789Z');
    const repo: jest.Mocked<CustomCommissionRequestRepositoryPort> = {
      create: jest.fn(async (request) => new CustomCommissionRequest(4, request.name, request.email, request.idea, request.idProduct, request.createdAt, request.expiresAt)),
      listActive: jest.fn(), purgeExpired: jest.fn(),
    };
    const useCase = new CreateCustomCommissionRequestUseCase(repo, () => now);
    const result = await useCase.execute({ name: 'Ari', email: 'ari@example.com', idea: 'A dragon', idProduct: null });
    expect(result.createdAt).toBe(now);
    expect(result.expiresAt.getTime()).toBe(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ idProduct: null }));
  });

  it('stores null when no product reference is provided', async () => {
    const repo = { create: jest.fn(async (r: any) => new CustomCommissionRequest(5, r.name, r.email, r.idea, r.idProduct, r.createdAt, r.expiresAt)), listActive: jest.fn(), purgeExpired: jest.fn() } as unknown as jest.Mocked<CustomCommissionRequestRepositoryPort>;
    const useCase = new CreateCustomCommissionRequestUseCase(repo, () => new Date('2026-09-01T00:00:00Z'));
    expect((await useCase.execute({ name: 'Sam', email: 'sam@example.com', idea: 'A comet' })).idProduct).toBeNull();
  });

  it('rejects a selected product that does not exist before persistence', async () => {
    const repo = { create: jest.fn(), listActive: jest.fn(), purgeExpired: jest.fn() } as unknown as jest.Mocked<CustomCommissionRequestRepositoryPort>;
    const products = { findById: jest.fn().mockResolvedValue(null) } as unknown as ProductRepositoryPort;
    const useCase = new CreateCustomCommissionRequestUseCase(repo, products);
    await expect(useCase.execute({ name: 'Sam', email: 'sam@example.com', idea: 'A comet', idProduct: 44 }))
      .rejects.toBeInstanceOf(SelectedProductNotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
