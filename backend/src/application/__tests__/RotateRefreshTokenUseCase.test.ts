import { RotateRefreshTokenUseCase, RefreshTokenRotationLostRaceError } from '../use-cases/RotateRefreshTokenUseCase';
import { UnitOfWorkPort, TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';
import { RememberToken } from '../../domain/entities/RememberToken';

// Scope note (found while implementing this task): tasks.md's task 1.10
// describes "D2's six lookup-order rows" for this use case's branch table.
// That six-row table (absent/revoked/expired/current/grace/replay) is
// design.md's `RefreshSessionUseCase` responsibility (task 2.10, PR2), which
// calls `findByHash` and branches BEFORE ever invoking rotation.
// `RotateRefreshTokenUseCase` is design.md D1's narrower, atomic
// claim -> insert successor -> reap transaction, invoked only for the
// "current" branch. It has exactly two outcomes: won the race (rotate) or
// lost it (throw so the caller re-reads outside the aborted transaction).
// Tested here accordingly.
describe('RotateRefreshTokenUseCase', () => {
  let mockRepo: jest.Mocked<RememberTokenRepositoryPort>;
  let mockHasher: jest.Mocked<TokenHasherPort>;
  let fakeTx: TransactionContext;
  let uow: UnitOfWorkPort;

  beforeEach(() => {
    fakeTx = {} as TransactionContext;
    uow = {
      runInTransaction: jest.fn((work) => work(fakeTx)),
    };
    mockRepo = {
      create: jest.fn(),
      findByHash: jest.fn(),
      deleteByHash: jest.fn(),
      claimRotation: jest.fn(),
      insertSuccessor: jest.fn(),
      revokeFamily: jest.fn(),
      reapFamily: jest.fn(),
    } as unknown as jest.Mocked<RememberTokenRepositoryPort>;
    mockHasher = { hash: jest.fn() } as unknown as jest.Mocked<TokenHasherPort>;
  });

  it('claims, inserts the successor with the inherited family/expiry, reaps with the injected cutoff, and returns the successor (won the race)', async () => {
    const expiry = new Date('2026-11-01T00:00:00Z');
    const current = new RememberToken(1, 'current-hash', 7, expiry, null, 'family-1');
    mockHasher.hash.mockReturnValue('new-hash');
    mockRepo.claimRotation.mockResolvedValue(true);
    const successor = new RememberToken(2, 'new-hash', 7, expiry, null, 'family-1');
    mockRepo.insertSuccessor.mockResolvedValue(successor);
    mockRepo.reapFamily.mockResolvedValue(1);

    // design.md D1: the reap cutoff is an injected 4th ctor argument, no
    // longer the module-level GRACE_SECONDS constant (was 30).
    const useCase = new RotateRefreshTokenUseCase(uow, mockRepo, mockHasher, 86400);
    const result = await useCase.execute(current, 'new-plain-token');

    expect(result).toBe(successor);
    expect(mockRepo.claimRotation).toHaveBeenCalledWith({
      presentedHash: 'current-hash',
      successorHash: 'new-hash',
      tx: fakeTx,
    });
    expect(mockRepo.insertSuccessor).toHaveBeenCalledWith(
      expect.objectContaining({ idUser: 7, tokenHash: 'new-hash', expiryDate: expiry, familyId: 'family-1' }),
      fakeTx
    );
    expect(mockRepo.reapFamily).toHaveBeenCalledWith('family-1', 86400, fakeTx);
  });

  it('reaps with whatever cutoff was injected at construction, not a hardcoded value', async () => {
    const expiry = new Date('2026-11-01T00:00:00Z');
    const current = new RememberToken(1, 'current-hash', 7, expiry, null, 'family-1');
    mockHasher.hash.mockReturnValue('new-hash');
    mockRepo.claimRotation.mockResolvedValue(true);
    const successor = new RememberToken(2, 'new-hash', 7, expiry, null, 'family-1');
    mockRepo.insertSuccessor.mockResolvedValue(successor);
    mockRepo.reapFamily.mockResolvedValue(0);

    const useCase = new RotateRefreshTokenUseCase(uow, mockRepo, mockHasher, 30);
    await useCase.execute(current, 'new-plain-token');

    expect(mockRepo.reapFamily).toHaveBeenCalledWith('family-1', 30, fakeTx);
  });

  it('throws and never inserts a successor or reaps when the claim loses the race', async () => {
    const expiry = new Date('2026-11-01T00:00:00Z');
    const current = new RememberToken(1, 'stale-hash', 7, expiry, null, 'family-1');
    mockHasher.hash.mockReturnValue('new-hash');
    mockRepo.claimRotation.mockResolvedValue(false);

    const useCase = new RotateRefreshTokenUseCase(uow, mockRepo, mockHasher, 86400);

    await expect(useCase.execute(current, 'new-plain-token')).rejects.toBeInstanceOf(
      RefreshTokenRotationLostRaceError
    );
    expect(mockRepo.insertSuccessor).not.toHaveBeenCalled();
    expect(mockRepo.reapFamily).not.toHaveBeenCalled();
  });
});
