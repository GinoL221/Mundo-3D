import { createDemoSandboxAuthUseCases } from '../DemoSandboxAuthUseCases';
import type { DemoSandboxProductRepositories } from '../DemoSandboxProductRepositories';
import type { PasswordHasherPort } from '../../../domain/ports/PasswordHasherPort';
import type { TokenHasherPort } from '../../../domain/ports/TokenHasherPort';
import type { IdGeneratorPort } from '../../../domain/ports/IdGeneratorPort';
import type { LoggerPort } from '../../../domain/ports/LoggerPort';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { RememberToken } from '../../../domain/entities/RememberToken';

jest.mock('../../../database/models/db', () => {
  throw new Error('default database forbidden');
});
jest.mock('dotenv', () => {
  throw new Error('dotenv forbidden');
});

test('composes each slot with its own injected repositories and rejects unknown slots', async () => {
  const userA = { findByEmail: jest.fn().mockResolvedValue(null) };
  const userB = { findByEmail: jest.fn().mockResolvedValue(null) };
  const tokenA = { findByHash: jest.fn().mockResolvedValue(null) };
  const tokenB = { findByHash: jest.fn().mockResolvedValue(null) };
  const uowA = {};
  const uowB = {};
  const select = <T>(slot: string, a: T, b: T): T => {
    if (slot === 'a') return a;
    if (slot === 'b') return b;
    throw new Error('unknown slot');
  };
  const repositories = {
    getUserRepository: jest.fn((slot: string) => select(slot, userA, userB)),
    getRememberTokenRepository: jest.fn((slot: string) => select(slot, tokenA, tokenB)),
    getUnitOfWork: jest.fn((slot: string) => select(slot, uowA, uowB)),
  } as unknown as DemoSandboxProductRepositories;
  const dependencies = {
    passwordHasher: {
      compareAgainstDecoy: jest.fn().mockResolvedValue(undefined),
    } as unknown as PasswordHasherPort,
    tokenHasher: { hash: jest.fn((value: string) => `hash:${value}`) } as TokenHasherPort,
    idGenerator: {} as IdGeneratorPort,
    logger: {} as LoggerPort,
    reapSeconds: 60,
  };
  expect(() => createDemoSandboxAuthUseCases(repositories, 'unknown', dependencies)).toThrow(
    'unknown slot',
  );
  const a = createDemoSandboxAuthUseCases(repositories, 'a', dependencies);
  const b = createDemoSandboxAuthUseCases(repositories, 'b', dependencies);
  await expect(
    a.authenticate.execute({ email: 'a@example.test', password: 'x' }),
  ).rejects.toThrow();
  expect(userA.findByEmail).toHaveBeenCalledWith('a@example.test');
  expect(userB.findByEmail).not.toHaveBeenCalled();
  await expect(
    b.refresh.execute({ presentedPlainToken: 'presented', newPlainToken: 'new' }),
  ).resolves.toEqual({ outcome: 'rejected' });
  expect(tokenB.findByHash).toHaveBeenCalledWith('hash:presented');
  expect(tokenA.findByHash).not.toHaveBeenCalled();
  expect(repositories.getUnitOfWork).toHaveBeenCalledWith('a');
  expect(repositories.getUnitOfWork).toHaveBeenCalledWith('b');
});

test('failed claim propagates through the injected unit of work without inserting a successor', async () => {
  const failure = new Error('claim failed');
  const tx = {} as TransactionContext;
  const current = new RememberToken(
    1,
    'hash:old',
    7,
    new Date(Date.now() + 3600_000),
    undefined,
    'family-a',
  );
  const tokens = {
    findByHash: jest.fn().mockResolvedValue(current),
    claimRotation: jest.fn().mockRejectedValue(failure),
    insertSuccessor: jest.fn(),
    reapFamily: jest.fn(),
  };
  const users = { findById: jest.fn() };
  const rollback = jest.fn();
  const uow = {
    runInTransaction: jest.fn(async (work: (context: TransactionContext) => Promise<unknown>) => {
      try {
        return await work(tx);
      } catch (error) {
        rollback();
        throw error;
      }
    }),
  };
  const otherSlot = jest.fn(() => {
    throw new Error('other slot must not be used');
  });
  const repositories = {
    getUserRepository: jest.fn((slot: string) => (slot === 'a' ? users : otherSlot())),
    getRememberTokenRepository: jest.fn((slot: string) => (slot === 'a' ? tokens : otherSlot())),
    getUnitOfWork: jest.fn((slot: string) => (slot === 'a' ? uow : otherSlot())),
  } as unknown as DemoSandboxProductRepositories;
  const auth = createDemoSandboxAuthUseCases(repositories, 'a', {
    passwordHasher: {} as PasswordHasherPort,
    tokenHasher: { hash: (value: string) => `hash:${value}` } as TokenHasherPort,
    idGenerator: {} as IdGeneratorPort,
    logger: {} as LoggerPort,
    reapSeconds: 60,
  });
  await expect(
    auth.refresh.execute({ presentedPlainToken: 'old', newPlainToken: 'new' }),
  ).rejects.toBe(failure);
  expect(tokens.findByHash).toHaveBeenCalledWith('hash:old');
  expect(tokens.claimRotation).toHaveBeenCalledTimes(1);
  expect(tokens.insertSuccessor).not.toHaveBeenCalled();
  expect(tokens.reapFamily).not.toHaveBeenCalled();
  expect(users.findById).not.toHaveBeenCalled();
  expect(rollback).toHaveBeenCalledTimes(1);
  expect(otherSlot).not.toHaveBeenCalled();
});

test('successful slot auth, issuance, rotation and revocation use the same injected slot', async () => {
  const expiry = new Date(Date.now() + 3600_000);
  const current = new RememberToken(1, 'hash:old', 7, expiry, undefined, 'family-a');
  const successor = new RememberToken(2, 'hash:new', 7, expiry, undefined, 'family-a');
  const user = {
    idUser: 7,
    firstName: 'A',
    lastName: 'User',
    email: 'a@example.test',
    password: 'stored',
    image: null,
  };
  const users = {
    findByEmail: jest.fn().mockResolvedValue(user),
    findById: jest.fn().mockResolvedValue(user),
  };
  const tx = {} as TransactionContext;
  const tokens = {
    create: jest.fn(async (token: Omit<RememberToken, 'idRememberToken'>) => ({
      ...token,
      idRememberToken: 3,
    })),
    findByHash: jest.fn().mockResolvedValue(current),
    claimRotation: jest.fn(
      async (_input: { presentedHash: string; successorHash: string; tx: TransactionContext }) =>
        true,
    ),
    insertSuccessor: jest.fn(async (_row: RememberToken, _tx: TransactionContext) => successor),
    reapFamily: jest.fn(async (_family: string, _seconds: number, _tx: TransactionContext) => 0),
    revokeFamily: jest.fn().mockResolvedValue(1),
  };
  const uow = {
    runInTransaction: jest.fn(async (work: (context: TransactionContext) => Promise<unknown>) =>
      work(tx),
    ),
  };
  const otherSlot = jest.fn(() => {
    throw new Error('other slot must not be used');
  });
  const repositories = {
    getUserRepository: jest.fn((slot: string) => (slot === 'a' ? users : otherSlot())),
    getRememberTokenRepository: jest.fn((slot: string) => (slot === 'a' ? tokens : otherSlot())),
    getUnitOfWork: jest.fn((slot: string) => (slot === 'a' ? uow : otherSlot())),
  } as unknown as DemoSandboxProductRepositories;
  const dependencies = {
    passwordHasher: { compare: jest.fn().mockResolvedValue(true) } as unknown as PasswordHasherPort,
    tokenHasher: { hash: jest.fn((value: string) => `hash:${value}`) } as TokenHasherPort,
    idGenerator: { generate: jest.fn(() => 'family-a') } as IdGeneratorPort,
    logger: {} as LoggerPort,
    reapSeconds: 60,
  };
  const auth = createDemoSandboxAuthUseCases(repositories, 'a', dependencies);
  await expect(
    auth.authenticate.execute({ email: user.email, password: 'plain' }),
  ).resolves.toMatchObject({ idUser: 7, email: user.email });
  expect(dependencies.passwordHasher.compare).toHaveBeenCalledWith('plain', 'stored');
  await expect(
    auth.createRememberToken.execute({ idUser: 7, plainToken: 'issued', durationSeconds: 60 }),
  ).resolves.toMatchObject({ tokenHash: 'hash:issued', familyId: 'family-a' });
  expect(tokens.create).toHaveBeenCalledWith(
    expect.objectContaining({ tokenHash: 'hash:issued', familyId: 'family-a', idUser: 7 }),
  );
  await expect(
    auth.refresh.execute({ presentedPlainToken: 'old', newPlainToken: 'new' }),
  ).resolves.toMatchObject({ outcome: 'rotated', familyId: 'family-a', refreshToken: successor });
  expect(uow.runInTransaction).toHaveBeenCalledTimes(1);
  expect(tokens.claimRotation).toHaveBeenCalledWith({
    presentedHash: 'hash:old',
    successorHash: 'hash:new',
    tx,
  });
  expect(tokens.claimRotation.mock.calls[0][0].tx).toBe(tx);
  expect(tokens.insertSuccessor).toHaveBeenCalledTimes(1);
  expect(tokens.insertSuccessor.mock.calls[0][0]).toMatchObject({
    tokenHash: 'hash:new',
    idUser: 7,
    familyId: 'family-a',
    expiryDate: expiry,
  });
  expect(tokens.insertSuccessor.mock.calls[0][1]).toBe(tx);
  expect(tokens.reapFamily).toHaveBeenCalledWith('family-a', 60, tx);
  expect(tokens.reapFamily.mock.calls[0][2]).toBe(tx);
  expect(tokens.claimRotation.mock.invocationCallOrder[0]).toBeLessThan(
    tokens.insertSuccessor.mock.invocationCallOrder[0],
  );
  expect(tokens.insertSuccessor.mock.invocationCallOrder[0]).toBeLessThan(
    tokens.reapFamily.mock.invocationCallOrder[0],
  );
  await expect(auth.revoke.execute('family-a')).resolves.toBe(1);
  expect(tokens.revokeFamily).toHaveBeenCalledWith('family-a');
  expect(otherSlot).not.toHaveBeenCalled();
});
