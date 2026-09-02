/**
 * REAL-DATABASE integration test — NOT mocked (except the disk `unlink`).
 *
 * Scope: proves that `SequelizeUserRepository.create()`'s `UniqueConstraintError`
 * translation (added to fix the registration race) actually holds up end to
 * end — real `SequelizeUserRepository` -> `RegisterUserUseCase` ->
 * `UserApiController.register`, invoked with `req`/`res` doubles, against a
 * real MySQL/MariaDB. Two concurrent registrations with the same,
 * previously-unused email must resolve into exactly one 201 and one 400 with
 * the sequential duplicate-email body, no 500, exactly one persisted row, and
 * the loser's uploaded avatar removed (not orphaned).
 *
 * `cleanupUploadedFile` runs under `NODE_ENV=test` here (forced by testDb.ts),
 * so it removes the loser's file from local disk — `fs.promises.unlink` is the
 * one stubbed seam so the test does not depend on a real file existing.
 * Production would issue a `DeleteObjectCommand` against R2 instead; that
 * branch is covered by the unit suite.
 *
 * This file is excluded from the default `npm test` run (see
 * `jest.config.js`'s `testPathIgnorePatterns`) and only runs via
 * `npm run test:integration`, which requires a reachable MySQL/MariaDB
 * (`DB_HOST`/`DB_USER`/`DB_PASS` env vars, see `database/config/config.js`).
 */
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { SequelizeUserRepository } from '../SequelizeUserRepository';
import { RegisterUserUseCase } from '../../../application/use-cases/RegisterUserUseCase';
import { BcryptPasswordHasher } from '../../security/BcryptPasswordHasher';
import { UserApiController } from '../../controllers/UserApiController';
import { CreateRememberTokenUseCase } from '../../../application/use-cases/CreateRememberTokenUseCase';
import { SequelizeRememberTokenRepository } from '../SequelizeRememberTokenRepository';
import { Sha256TokenHasher } from '../../security/Sha256TokenHasher';
import { CryptoRandomIdGenerator } from '../../security/CryptoRandomIdGenerator';
import { bootstrapTestDatabase, closeTestDatabase, getTestDb } from '../../../__tests__/helpers/testDb';

const unlinkMock = jest
  .spyOn(fs.promises, 'unlink')
  .mockResolvedValue(undefined as never);

const uploadDir = (key: string): string => path.join(process.cwd(), 'public', 'img', key);

// Env prerequisite (design.md): the 201 path calls setSessionCookies ->
// getJwtSecret() / issueCsrfToken() -> getCookieSecret(). Both already fall
// back to a deterministic TEST_SECRET under NODE_ENV=test (forced by
// testDb.ts), but these are set explicitly to match the documented
// prerequisite and to stay correct if that fallback ever changes.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-jwt-secret-not-for-production';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test-only-cookie-secret-not-for-production';

jest.setTimeout(30000);

type ReqWithFile = Request & { file?: { key: string; location: string; path: string } };

function buildResDouble(): Response {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

/** Bounded poll for `cleanupUploadedFile`'s fire-and-forget unlink to land. */
async function waitUntilUnlinked(key: string, timeoutMs = 2000, intervalMs = 50): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  const wasUnlinked = (): boolean =>
    unlinkMock.mock.calls.some(([target]) => target === uploadDir(key));
  while (Date.now() < deadline) {
    if (wasUnlinked()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return wasUnlinked();
}

describe('SequelizeUserRepository.create — real DB registration race', () => {
  const db = getTestDb();
  let controller: UserApiController;
  const email = `race-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  beforeAll(async () => {
    await bootstrapTestDatabase();
    unlinkMock.mockClear();

    const authStub = { execute: jest.fn() } as any;
    const listStub = { execute: jest.fn() } as any;
    const getStub = { execute: jest.fn() } as any;
    const registerUserUseCase = new RegisterUserUseCase(
      new SequelizeUserRepository(),
      new BcryptPasswordHasher()
    );
    // `register` now establishes a session, which writes a real RememberToken
    // row — so this must be the genuine use case, not a stub, or the
    // controller throws before it can return 201 and the race this file
    // exists to test never resolves. Mirrors the composition in
    // `routes/api/users.ts`; the refresh/revoke use cases stay absent because
    // registration never reaches them.
    const createRememberTokenUseCase = new CreateRememberTokenUseCase(
      new SequelizeRememberTokenRepository(),
      new Sha256TokenHasher(),
      new CryptoRandomIdGenerator()
    );
    controller = new UserApiController(
      authStub,
      listStub,
      getStub,
      registerUserUseCase,
      createRememberTokenUseCase
    );
  });

  afterAll(async () => {
    await db.User.destroy({ where: { email } });
    await closeTestDatabase();
    unlinkMock.mockRestore();
  });

  it('resolves a concurrent duplicate-email registration into exactly one 201 and one 400, no 500, one DB row, and no orphaned upload', async () => {
    const keyA = 'users/race-a.png';
    const keyB = 'users/race-b.png';

    const reqA: ReqWithFile = {
      body: { firstName: 'Race', lastName: 'A', email, password: 'password123' },
      file: { key: keyA, location: 'race-a.png', path: uploadDir(keyA) },
    } as any;
    const reqB: ReqWithFile = {
      body: { firstName: 'Race', lastName: 'B', email, password: 'password123' },
      file: { key: keyB, location: 'race-b.png', path: uploadDir(keyB) },
    } as any;

    const resA = buildResDouble();
    const resB = buildResDouble();
    const nextA = jest.fn() as unknown as NextFunction;
    const nextB = jest.fn() as unknown as NextFunction;

    await Promise.all([
      controller.register(reqA, resA, nextA),
      controller.register(reqB, resB, nextB),
    ]);

    const outcomes = [
      { res: resA, next: nextA, req: reqA },
      { res: resB, next: nextB, req: reqB },
    ];

    const winners = outcomes.filter((o) => (o.res.status as jest.Mock).mock.calls.some((c) => c[0] === 201));
    const losers = outcomes.filter((o) => (o.res.status as jest.Mock).mock.calls.some((c) => c[0] === 400));

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);

    expect(losers[0].res.json).toHaveBeenCalledWith({ error: 'Este email ya está registrado' });

    // No 500 path on either side.
    expect(nextA).not.toHaveBeenCalled();
    expect(nextB).not.toHaveBeenCalled();

    // Exactly one persisted row for this email.
    const count = await db.User.count({ where: { email } });
    expect(count).toBe(1);

    // The winner's res.json call carries the persisted row's idUser.
    const persisted = await db.User.findOne({ where: { email } });
    const winnerJsonCall = (winners[0].res.json as jest.Mock).mock.calls.find(
      (c) => c[0]?.user?.idUser !== undefined
    );
    expect(winnerJsonCall[0].user.idUser).toBe(persisted.idUser);

    // Loser's uploaded avatar is removed; winner's is retained.
    const loserKey = losers[0].req.file!.key;
    const winnerKey = winners[0].req.file!.key;

    const unlinked = await waitUntilUnlinked(loserKey);
    expect(unlinked).toBe(true);

    const winnerUnlinked = unlinkMock.mock.calls.some(
      ([target]) => target === uploadDir(winnerKey)
    );
    expect(winnerUnlinked).toBe(false);
  });
});
