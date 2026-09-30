import { ListCustomCommissionRequestsUseCase } from '../use-cases/ListCustomCommissionRequestsUseCase';
import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';

describe('ListCustomCommissionRequestsUseCase', () => {
  it('asks the repository for active rows at a deterministic current time', async () => {
    const now = new Date('2026-10-01T00:00:00Z');
    const repo = { listActive: jest.fn().mockResolvedValue([]) } as unknown as CustomCommissionRequestRepositoryPort;
    await new ListCustomCommissionRequestsUseCase(repo, () => now).execute();
    expect(repo.listActive).toHaveBeenCalledWith(now);
  });
});
