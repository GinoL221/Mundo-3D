import { ListMyCustomCommissionRequestsUseCase } from '../use-cases/ListMyCustomCommissionRequestsUseCase';
import { CustomCommissionRequest } from '../../domain/entities/CustomCommissionRequest';

describe('ListMyCustomCommissionRequestsUseCase', () => {
  it('delegates to repository.listActiveByUser with the current clock date', async () => {
    const now = new Date('2026-11-27T12:00:00.000Z');
    const item = new CustomCommissionRequest(
      1,
      'Demo Buyer',
      'buyer@sandbox.invalid',
      'Custom stand',
      1,
      new Date('2026-11-27T10:00:00.000Z'),
      new Date('2026-12-27T10:00:00.000Z'),
      '+54 9 11 0000-0101',
      1,
    );
    const repo = {
      create: jest.fn(),
      listActive: jest.fn(),
      listActiveByUser: jest.fn().mockResolvedValue([item]),
      purgeExpired: jest.fn(),
    };
    const useCase = new ListMyCustomCommissionRequestsUseCase(repo, () => now);

    await expect(useCase.execute(1)).resolves.toEqual([item]);
    expect(repo.listActiveByUser).toHaveBeenCalledWith(1, now);
  });
});
