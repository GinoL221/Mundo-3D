import { PurgeExpiredCommissionRequestsUseCase } from '../use-cases/PurgeExpiredCommissionRequestsUseCase';
import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';

describe('PurgeExpiredCommissionRequestsUseCase', () => {
  it('purges rows expired at or before the current time', async () => {
    const now = new Date('2026-10-01T00:00:00Z');
    const repo = { purgeExpired: jest.fn().mockResolvedValue(2) } as unknown as CustomCommissionRequestRepositoryPort;
    const useCase = new PurgeExpiredCommissionRequestsUseCase(repo, () => now);
    await expect(useCase.execute()).resolves.toBe(2);
    expect(repo.purgeExpired).toHaveBeenCalledWith(now);
  });
});
