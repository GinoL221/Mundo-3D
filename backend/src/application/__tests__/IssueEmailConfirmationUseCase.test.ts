import { EmailConfirmationToken } from '../../domain/entities/EmailConfirmationToken';
import { TransactionContext, UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';

// RED-only: the issuer does not exist until the following GREEN work unit.
const { IssueEmailConfirmationUseCase } = require('../use-cases/IssueEmailConfirmationUseCase');

const token = 'opaque-test-token';
const digest = 'a'.repeat(64);
const now = new Date('2026-10-01T12:00:00.000Z');

describe('IssueEmailConfirmationUseCase', () => {
  function setup(replace: jest.Mock = jest.fn()) {
    const events: string[] = [];
    const tx = {} as TransactionContext;
    const unitOfWork: UnitOfWorkPort = {
      runInTransaction: async (work) => {
        events.push('begin');
        const result = await work(tx);
        events.push('commit');
        return result;
      },
    };
    const repository = { replaceForUnverifiedUser: replace };
    const generator = { generate: jest.fn(() => token) };
    const hasher = { hash: jest.fn(() => digest) };
    const origin = {
      buildConfirmationUrl: jest.fn(
        () => 'https://app.example/confirm-email?token=opaque-test-token',
      ),
    };
    const mail = {
      sendEmailConfirmation: jest.fn(async () => {
        events.push('mail');
      }),
    };
    const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
    const useCase = new IssueEmailConfirmationUseCase(
      repository,
      unitOfWork,
      generator,
      hasher,
      origin,
      mail,
      { now: () => now },
      logger,
    );
    return { events, repository, generator, hasher, origin, mail, logger, useCase };
  }

  it('commits the replacement before sending the mail intent', async () => {
    const replacement = EmailConfirmationToken.createPending({
      recordId: 91,
      userId: 7,
      tokenHash: digest,
      now,
    });
    const f = setup(
      jest.fn().mockResolvedValue({ token: replacement, recipient: 'recipient@example.test' }),
    );

    await f.useCase.issueForUser(7);

    expect(f.repository.replaceForUnverifiedUser).toHaveBeenCalledWith({
      userId: 7,
      tokenHash: digest,
      now,
      tx: expect.any(Object),
    });
    expect(f.events).toEqual(['begin', 'commit', 'mail']);
    expect(f.mail.sendEmailConfirmation).toHaveBeenCalledWith({
      to: 'recipient@example.test',
      confirmationUrl: expect.stringContaining('/confirm-email?token='),
      expiresAt: replacement.expiresAt,
      idempotencyKey: 'email-confirmation-token:91',
    });
  });

  it('never calls mail after persistence failure', async () => {
    const persistFailure = setup(jest.fn().mockRejectedValue(new Error('database unavailable')));

    await expect(persistFailure.useCase.issueForUser(7)).rejects.toThrow('database unavailable');

    expect(persistFailure.events).toEqual(['begin']);
    expect(persistFailure.mail.sendEmailConfirmation).not.toHaveBeenCalled();
    expect(persistFailure.logger.warn).not.toHaveBeenCalled();
  });

  it('retains the committed usable token and logs no secret when post-commit mail fails', async () => {
    const recipient = 'recipient+private@example.test';
    const replacement = EmailConfirmationToken.createPending({
      recordId: 92,
      userId: 7,
      tokenHash: digest,
      now,
    });
    const mailFailure = setup(jest.fn().mockResolvedValue({ token: replacement, recipient }));
    mailFailure.mail.sendEmailConfirmation.mockRejectedValue(
      new Error('recipient and token must stay secret'),
    );

    await expect(mailFailure.useCase.issueForUser(7)).resolves.toEqual({ outcome: 'mail-failed' });

    expect(mailFailure.events).toEqual(['begin', 'commit']);
    expect(replacement).toEqual(
      expect.objectContaining({ activeSlot: 1, consumedAt: null, invalidatedAt: null }),
    );
    expect(mailFailure.logger.warn).toHaveBeenCalledWith({ outcome: 'smtp_failed', recordId: 92 });
    const loggedArguments = mailFailure.logger.warn.mock.calls.flat().map(String).join(' ');
    for (const forbidden of [recipient, token, digest, 'https://app.example/confirm-email']) {
      expect(loggedArguments).not.toContain(forbidden);
    }
  });
});
