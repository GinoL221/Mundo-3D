import { InvalidEmailConfirmationToken } from '../../../domain/exceptions/InvalidEmailConfirmationToken';

// RED-only: confirmation behavior is deliberately absent until the next GREEN unit.
const { ConfirmEmailUseCase } = require('../ConfirmEmailUseCase');

const plaintext = 'opaque-confirmation-token';
const digest = 'a'.repeat(64);
const now = new Date('2026-10-02T12:00:00.000Z');

describe('ConfirmEmailUseCase', () => {
  const setup = () => {
    const repository = {
      findUserIdByTokenHash: jest.fn(),
      verifyAndConsume: jest.fn(),
    };
    const unitOfWork = {
      runInTransaction: jest.fn(async (work) => work({})),
    };
    const useCase = new ConfirmEmailUseCase(
      repository,
      unitOfWork,
      { hash: jest.fn(() => digest) },
      { now: () => now },
    );
    return { repository, unitOfWork, useCase };
  };

  it.each(['unknown', 'expired', 'superseded'])(
    'rejects %s digests with the same internal invalid outcome',
    async (state) => {
      const f = setup();
      f.repository.findUserIdByTokenHash.mockResolvedValue(17);
      f.repository.verifyAndConsume.mockResolvedValue({ outcome: state });

      await expect(f.useCase.execute({ token: plaintext })).rejects.toBeInstanceOf(
        InvalidEmailConfirmationToken,
      );
      expect(f.repository.findUserIdByTokenHash).toHaveBeenCalledWith(digest);
      expect(f.repository.verifyAndConsume).toHaveBeenCalledWith({
        userId: 17,
        tokenHash: digest,
        now,
        tx: expect.any(Object),
      });
    },
  );

  it('returns success for the winner and the consumed-plus-verified retry', async () => {
    const f = setup();
    f.repository.findUserIdByTokenHash.mockResolvedValue(17);
    f.repository.verifyAndConsume
      .mockResolvedValueOnce({ outcome: 'confirmed' })
      .mockResolvedValueOnce({ outcome: 'idempotent' });

    await expect(f.useCase.execute({ token: plaintext })).resolves.toEqual({
      outcome: 'confirmed',
    });
    await expect(f.useCase.execute({ token: plaintext })).resolves.toEqual({
      outcome: 'idempotent',
    });
  });

  it('allows one state-changing winner while concurrent retries observe idempotent success', async () => {
    const f = setup();
    f.repository.findUserIdByTokenHash.mockResolvedValue(17);
    f.repository.verifyAndConsume
      .mockResolvedValueOnce({ outcome: 'confirmed' })
      .mockResolvedValueOnce({ outcome: 'idempotent' });

    const results = await Promise.all([
      f.useCase.execute({ token: plaintext }),
      f.useCase.execute({ token: plaintext }),
    ]);
    expect(
      results.filter((result: { outcome: string }) => result.outcome === 'confirmed'),
    ).toHaveLength(1);
    expect(
      results.filter((result: { outcome: string }) => result.outcome === 'idempotent'),
    ).toHaveLength(1);
  });

  it('does not report success when the atomic verification-and-consumption transaction rolls back', async () => {
    const f = setup();
    f.repository.findUserIdByTokenHash.mockResolvedValue(17);
    f.unitOfWork.runInTransaction.mockRejectedValue(new Error('forced partial failure'));

    await expect(f.useCase.execute({ token: plaintext })).rejects.toThrow('forced partial failure');
    expect(f.repository.verifyAndConsume).not.toHaveBeenCalled();
  });
});
