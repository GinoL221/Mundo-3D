/**
 * REAL-DATABASE integration test — NOT mocked.
 *
 * Scope: proves that `SequelizeUserRepository.create()`'s `UniqueConstraintError`
 * translation (added to fix the registration race) actually holds up end to
 * end — real `SequelizeUserRepository` -> `RegisterUserUseCase` ->
 * `UserApiController.register`, invoked with `req`/`res` doubles, against a
 * real MySQL/MariaDB. Two concurrent registrations with the same,
 * previously-unused email must resolve into exactly one 201 and one 400 with
 * the sequential duplicate-email body, no 500, exactly one persisted row, and
 * the loser's uploaded avatar file cleaned up (not orphaned).
 *
 * This file is excluded from the default `npm test` run (see
 * `jest.config.js`'s `testPathIgnorePatterns`) and only runs via
 * `npm run test:integration`, which requires a reachable MySQL/MariaDB
 * (`DB_HOST`/`DB_USER`/`DB_PASS` env vars, see `database/config/config.js`).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { SequelizeUserRepository } from '../SequelizeUserRepository';
import { RegisterUserUseCase } from '../../../application/use-cases/RegisterUserUseCase';
import { BcryptPasswordHasher } from '../../security/BcryptPasswordHasher';
import { UserApiController } from '../../controllers/UserApiController';
import { bootstrapTestDatabase, closeTestDatabase, getTestDb } from '../../../__tests__/helpers/testDb';

// Env prerequisite (design.md): the 201 path calls setSessionCookies ->
// getJwtSecret() / issueCsrfToken() -> getCookieSecret(). Both already fall
// back to a deterministic TEST_SECRET under NODE_ENV=test (forced by
// testDb.ts), but these are set explicitly to match the documented
// prerequisite and to stay correct if that fallback ever changes.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-jwt-secret-not-for-production';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test-only-cookie-secret-not-for-production';

jest.setTimeout(30000);

type ReqWithFile = Request & { file?: { filename: string; path?: string } };

function buildResDouble(): Response {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

/** Bounded poll for `cleanupUploadedFile`'s fire-and-forget fs.unlink to land. */
async function waitUntilRemoved(filePath: string, timeoutMs = 2000, intervalMs = 50): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!fs.existsSync(filePath)) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return !fs.existsSync(filePath);
}

describe('SequelizeUserRepository.create — real DB registration race', () => {
  const db = getTestDb();
  let controller: UserApiController;
  let tmpDir: string;
  const email = `race-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  beforeAll(async () => {
    await bootstrapTestDatabase();

    const authStub = { execute: jest.fn() } as any;
    const listStub = { execute: jest.fn() } as any;
    const getStub = { execute: jest.fn() } as any;
    const registerUserUseCase = new RegisterUserUseCase(
      new SequelizeUserRepository(),
      new BcryptPasswordHasher()
    );
    controller = new UserApiController(authStub, listStub, getStub, registerUserUseCase);

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm3d-race-'));
  });

  afterAll(async () => {
    await db.User.destroy({ where: { email } });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await closeTestDatabase();
  });

  it('resolves a concurrent duplicate-email registration into exactly one 201 and one 400, no 500, one DB row, and no orphaned upload', async () => {
    const fileA = path.join(tmpDir, 'avatar-a.png');
    const fileB = path.join(tmpDir, 'avatar-b.png');
    fs.writeFileSync(fileA, 'avatar-a');
    fs.writeFileSync(fileB, 'avatar-b');

    const reqA: ReqWithFile = {
      body: { firstName: 'Race', lastName: 'A', email, password: 'password123' },
      file: { filename: 'avatar-a.png', path: fileA },
    } as any;
    const reqB: ReqWithFile = {
      body: { firstName: 'Race', lastName: 'B', email, password: 'password123' },
      file: { filename: 'avatar-b.png', path: fileB },
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

    // Loser's temp file is gone; winner's temp file still exists.
    const loserFilePath = losers[0].req.file!.path as string;
    const winnerFilePath = winners[0].req.file!.path as string;

    const removed = await waitUntilRemoved(loserFilePath);
    expect(removed).toBe(true);
    expect(fs.existsSync(winnerFilePath)).toBe(true);
  });
});
