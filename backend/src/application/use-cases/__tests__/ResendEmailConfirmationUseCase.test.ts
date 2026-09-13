import { User } from '../../../domain/entities/User';

const { ResendEmailConfirmationUseCase } = require('../ResendEmailConfirmationUseCase');

const eligibleUser = new User(
  41,
  'Ada',
  'Lovelace',
  'eligible@example.com',
  'hash',
  null,
  2,
  'User',
  null,
);
const verifiedUser = new User(
  42,
  'Grace',
  'Hopper',
  'verified@example.com',
  'hash',
  null,
  2,
  'User',
  new Date('2026-10-02T12:00:00.000Z'),
);

describe('ResendEmailConfirmationUseCase', () => {
  const setup = (user: User | null, outcome = { outcome: 'issued' }) => {
    const users = { findByEmail: jest.fn().mockResolvedValue(user) };
    const issuer = { issueForUser: jest.fn().mockResolvedValue(outcome) };
    const limiter = { reserve: jest.fn(() => true), release: jest.fn() };
    return {
      users,
      issuer,
      limiter,
      useCase: new ResendEmailConfirmationUseCase(users, issuer, limiter),
    };
  };

  it.each([
    ['absent', null],
    ['verified', verifiedUser],
  ])('accepts %s accounts without creating a token or delivery attempt', async (_kind, user) => {
    const f = setup(user);

    await expect(f.useCase.execute({ email: '  PRIVATE@EXAMPLE.COM  ' })).resolves.toEqual({
      outcome: 'accepted',
    });

    expect(f.users.findByEmail).toHaveBeenCalledWith('private@example.com');
    expect(f.limiter.reserve).not.toHaveBeenCalled();
    expect(f.issuer.issueForUser).not.toHaveBeenCalled();
  });

  it('reserves an eligible normalized account before one replacement attempt', async () => {
    const f = setup(eligibleUser);

    await expect(f.useCase.execute({ email: '  ELIGIBLE@EXAMPLE.COM ' })).resolves.toEqual({
      outcome: 'accepted',
    });

    expect(f.limiter.reserve).toHaveBeenCalledWith('eligible@example.com');
    expect(f.issuer.issueForUser).toHaveBeenCalledWith(41);
    expect(f.limiter.release).not.toHaveBeenCalled();
  });

  it.each([
    ['verified during issuance', { outcome: 'not-eligible' }],
    ['pre-SMTP persistence failure', new Error('persistence failed')],
  ])('releases an eligible reservation before SMTP invocation when %s', async (_reason, result) => {
    const f = setup(eligibleUser);
    if (result instanceof Error) f.issuer.issueForUser.mockRejectedValue(result);
    else f.issuer.issueForUser.mockResolvedValue(result);

    await expect(f.useCase.execute({ email: eligibleUser.email })).resolves.toEqual({
      outcome: 'accepted',
    });
    expect(f.limiter.release).toHaveBeenCalledWith('eligible@example.com');
  });

  it('retains a reservation after the issuer reports a post-SMTP rejection', async () => {
    const f = setup(eligibleUser, { outcome: 'mail-failed' });

    await expect(f.useCase.execute({ email: eligibleUser.email })).resolves.toEqual({
      outcome: 'accepted',
    });
    expect(f.issuer.issueForUser).toHaveBeenCalledWith(41);
    expect(f.limiter.release).not.toHaveBeenCalled();
  });
});
