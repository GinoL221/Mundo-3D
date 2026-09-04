import { RefreshSessionUseCase } from '../use-cases/RefreshSessionUseCase';
import { RefreshTokenRotatorPort } from '../../domain/ports/RefreshTokenRotatorPort';
import { RefreshTokenRotationLostRaceError } from '../../domain/exceptions/RefreshTokenRotationLostRaceError';
import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';
import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { RememberToken } from '../../domain/entities/RememberToken';
import { User } from '../../domain/entities/User';

// design.md D2's lookup-order branch table, the six rows tasks.md's task
// 1.10 originally (incorrectly) assigned to RotateRefreshTokenUseCase —
// corrected in PR1's apply-progress to belong here instead.
describe('RefreshSessionUseCase', () => {
  let mockRepo: jest.Mocked<RememberTokenRepositoryPort>;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockHasher: jest.Mocked<TokenHasherPort>;
  let mockRotate: jest.Mocked<RefreshTokenRotatorPort>;
  let mockLogger: jest.Mocked<LoggerPort>;
  let useCase: RefreshSessionUseCase;

  const now = new Date('2026-09-01T12:00:00Z');
  const future = new Date('2026-09-01T14:00:00Z');
  const past = new Date('2026-09-01T10:00:00Z');

  const fakeUser = {
    idUser: 7,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    image: null,
    idRole: 2,
    category: 'User',
  } as unknown as User;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);

    mockRepo = {
      create: jest.fn(),
      findByHash: jest.fn(),
      deleteByHash: jest.fn(),
      claimRotation: jest.fn(),
      insertSuccessor: jest.fn(),
      revokeFamily: jest.fn(),
      reapFamily: jest.fn(),
    } as unknown as jest.Mocked<RememberTokenRepositoryPort>;

    mockUserRepo = { findById: jest.fn() } as unknown as jest.Mocked<UserRepositoryPort>;
    mockHasher = { hash: jest.fn((t: string) => `hash(${t})`) } as unknown as jest.Mocked<TokenHasherPort>;
    mockRotate = { execute: jest.fn() } as unknown as jest.Mocked<RefreshTokenRotatorPort>;
    mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as jest.Mocked<LoggerPort>;

    mockUserRepo.findById.mockResolvedValue(fakeUser);
    mockRepo.revokeFamily.mockResolvedValue(1);

    useCase = new RefreshSessionUseCase(mockRepo, mockUserRepo, mockHasher, mockRotate, mockLogger);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('row 1: absent token -> rejected', async () => {
    mockRepo.findByHash.mockResolvedValue(null);

    const result = await useCase.execute({ presentedPlainToken: 'ghost', newPlainToken: 'new' });

    expect(result.outcome).toBe('rejected');
    expect(mockRotate.execute).not.toHaveBeenCalled();
    // A hash we never issued, or one already past retention, names no
    // family to revoke — not a reuse signal (design.md D2 row 1).
    expect(mockRepo.revokeFamily).not.toHaveBeenCalled();
  });

  it('row 2: revoked token -> rejected (logout beats grace, even if still within grace)', async () => {
    const revoked = new RememberToken(1, 'hash(revoked)', 7, future, null, 'fam-1', now, 'succ-hash', now);
    mockRepo.findByHash.mockResolvedValue(revoked);

    const result = await useCase.execute({ presentedPlainToken: 'revoked', newPlainToken: 'new' });

    expect(result.outcome).toBe('rejected');
    expect(mockRotate.execute).not.toHaveBeenCalled();
    // The family is already terminal — logout beat grace, not reuse
    // (design.md D2 row 2).
    expect(mockRepo.revokeFamily).not.toHaveBeenCalled();
  });

  it('row 3: expired token -> rejected', async () => {
    const expired = new RememberToken(1, 'hash(expired)', 7, past, null, 'fam-1');
    mockRepo.findByHash.mockResolvedValue(expired);

    const result = await useCase.execute({ presentedPlainToken: 'expired', newPlainToken: 'new' });

    expect(result.outcome).toBe('rejected');
    // Time, not theft (design.md D2 row 3).
    expect(mockRepo.revokeFamily).not.toHaveBeenCalled();
  });

  it('guard: a superseded row with no familyId -> rejected, no revocation (cannot name a family to revoke)', async () => {
    const noFamily = new RememberToken(1, 'hash(nofamily)', 7, future, null, null, now, 'succ-hash');
    mockRepo.findByHash.mockResolvedValue(noFamily);

    const result = await useCase.execute({ presentedPlainToken: 'nofamily', newPlainToken: 'new' });

    expect(result.outcome).toBe('rejected');
    expect(mockRepo.revokeFamily).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('row 4: current (non-superseded) token -> rotates and returns the successor + user + familyId', async () => {
    const current = new RememberToken(1, 'hash(current)', 7, future, null, 'fam-1');
    mockRepo.findByHash.mockResolvedValue(current);
    const successor = new RememberToken(2, 'hash(new)', 7, future, null, 'fam-1');
    mockRotate.execute.mockResolvedValue(successor);

    const result = await useCase.execute({ presentedPlainToken: 'current', newPlainToken: 'new' });

    expect(result.outcome).toBe('rotated');
    if (result.outcome === 'rotated') {
      expect(result.refreshToken).toBe(successor);
      expect(result.user.idUser).toBe(7);
      expect(result.familyId).toBe('fam-1');
    }
    expect(mockRotate.execute).toHaveBeenCalledWith(current, 'new');
  });

  it('row 5: grace hit (superseded < 30s ago, successor exists unrevoked/unexpired) -> grace, no rotation', async () => {
    const supersededAt = new Date(now.getTime() - 10 * 1000); // 10s ago, within 30s grace
    const current = new RememberToken(1, 'hash(current)', 7, future, null, 'fam-1', supersededAt, 'hash(succ)');
    const successorRow = new RememberToken(2, 'hash(succ)', 7, future, null, 'fam-1');
    mockRepo.findByHash.mockImplementation(async (hash: string) => {
      if (hash === 'hash(current)') return current;
      if (hash === 'hash(succ)') return successorRow;
      return null;
    });

    const result = await useCase.execute({ presentedPlainToken: 'current', newPlainToken: 'new' });

    expect(result.outcome).toBe('grace');
    if (result.outcome === 'grace') {
      expect(result.user.idUser).toBe(7);
      expect(result.familyId).toBe('fam-1');
    }
    expect(mockRotate.execute).not.toHaveBeenCalled();
    // The grace path must leave the family untouched — that is what lets
    // concurrent tabs resolve against one another without contending. It was
    // only inferable from the absence of calls in the implementation, so a
    // regression would have broken it silently.
    expect(mockRepo.claimRotation).not.toHaveBeenCalled();
    expect(mockRepo.insertSuccessor).not.toHaveBeenCalled();
    expect(mockRepo.reapFamily).not.toHaveBeenCalled();
    expect(mockRepo.revokeFamily).not.toHaveBeenCalled();
    // Nor may it raise a reuse alarm: two of a user's own tabs racing is the
    // case grace exists for, and an operator paging on that would learn to
    // ignore the signal that actually matters.
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('row 6: replay past grace (superseded 30+s ago) -> revokes the whole family, logs once, and reports reuse-detected', async () => {
    const supersededAt = new Date(now.getTime() - 45 * 1000); // 45s ago, past 30s grace
    const current = new RememberToken(1, 'hash(current)', 7, future, null, 'fam-1', supersededAt, 'hash(succ)');
    mockRepo.findByHash.mockResolvedValue(current);

    const result = await useCase.execute({ presentedPlainToken: 'current', newPlainToken: 'new' });

    expect(result.outcome).toBe('reuse-detected');
    expect(mockRepo.revokeFamily).toHaveBeenCalledTimes(1);
    expect(mockRepo.revokeFamily).toHaveBeenCalledWith('fam-1');
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('row 6: the log entry carries familyId, userId, ageSeconds and the REAL revokedRows (revoke runs before log), and excludes tokenHash/successorHash', async () => {
    const supersededAt = new Date(now.getTime() - 45 * 1000); // 45s ago
    const current = new RememberToken(1, 'hash(current)', 7, future, null, 'fam-1', supersededAt, 'hash(succ)');
    mockRepo.findByHash.mockResolvedValue(current);
    mockRepo.revokeFamily.mockResolvedValue(2);

    await useCase.execute({ presentedPlainToken: 'current', newPlainToken: 'new' });

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    const [loggedObject] = mockLogger.warn.mock.calls[0];

    expect(loggedObject).toMatchObject({
      familyId: 'fam-1',
      userId: 7,
      revokedRows: 2,
    });
    expect((loggedObject as { ageSeconds: number }).ageSeconds).toBeCloseTo(45, 0);
    // Negative assertion: a future field addition on the logged object must
    // not quietly leak session-identifying material (design.md D6).
    expect(loggedObject).not.toHaveProperty('tokenHash');
    expect(loggedObject).not.toHaveProperty('successorHash');
  });

  it('row 6: a revokeFamily rejection propagates — not swallowed into a 401-shaped rejected outcome', async () => {
    const supersededAt = new Date(now.getTime() - 45 * 1000);
    const current = new RememberToken(1, 'hash(current)', 7, future, null, 'fam-1', supersededAt, 'hash(succ)');
    mockRepo.findByHash.mockResolvedValue(current);
    mockRepo.revokeFamily.mockRejectedValue(new Error('DB unavailable'));

    await expect(useCase.execute({ presentedPlainToken: 'current', newPlainToken: 'new' })).rejects.toThrow(
      'DB unavailable'
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('a lost rotation race re-reads outside the aborted transaction and resolves grace/reject from fresh data', async () => {
    const current = new RememberToken(1, 'hash(current)', 7, future, null, 'fam-1');
    const supersededAt = new Date(now.getTime() - 5 * 1000);
    const refreshedRow = new RememberToken(1, 'hash(current)', 7, future, null, 'fam-1', supersededAt, 'hash(succ)');
    const successorRow = new RememberToken(2, 'hash(succ)', 7, future, null, 'fam-1');

    mockRepo.findByHash
      .mockResolvedValueOnce(current) // initial read
      .mockResolvedValueOnce(refreshedRow) // re-read after lost race
      .mockResolvedValueOnce(successorRow); // successor lookup for the grace check

    mockRotate.execute.mockRejectedValue(new RefreshTokenRotationLostRaceError());

    const result = await useCase.execute({ presentedPlainToken: 'current', newPlainToken: 'new' });

    expect(result.outcome).toBe('grace');
    // A lost race is the other way an honest tab reaches the grace path, so it
    // must stay as silent as row 5 — no revocation, no reuse alarm.
    expect(mockRepo.revokeFamily).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
