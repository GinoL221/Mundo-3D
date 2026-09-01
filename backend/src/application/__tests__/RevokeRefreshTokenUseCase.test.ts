import { RevokeRefreshTokenUseCase } from '../use-cases/RevokeRefreshTokenUseCase';
import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';

describe('RevokeRefreshTokenUseCase', () => {
  let mockRepo: jest.Mocked<RememberTokenRepositoryPort>;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findByHash: jest.fn(),
      deleteByHash: jest.fn(),
      claimRotation: jest.fn(),
      insertSuccessor: jest.fn(),
      revokeFamily: jest.fn(),
      reapFamily: jest.fn(),
    } as unknown as jest.Mocked<RememberTokenRepositoryPort>;
  });

  it('revokes every row in the family and returns the affected count', async () => {
    mockRepo.revokeFamily.mockResolvedValue(2);

    const useCase = new RevokeRefreshTokenUseCase(mockRepo);
    const result = await useCase.execute('family-1');

    expect(result).toBe(2);
    expect(mockRepo.revokeFamily).toHaveBeenCalledWith('family-1');
  });

  it('returns 0 when the family has nothing left to revoke', async () => {
    mockRepo.revokeFamily.mockResolvedValue(0);

    const useCase = new RevokeRefreshTokenUseCase(mockRepo);
    const result = await useCase.execute('already-revoked-family');

    expect(result).toBe(0);
  });
});
