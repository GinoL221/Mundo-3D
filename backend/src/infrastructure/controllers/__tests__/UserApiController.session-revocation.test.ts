import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { UserApiController } from '../UserApiController';
import { RevokeRefreshTokenUseCase } from '../../../application/use-cases/RevokeRefreshTokenUseCase';
import { RefreshSessionUseCase } from '../../../application/use-cases/RefreshSessionUseCase';
import { RotateRefreshTokenUseCase } from '../../../application/use-cases/RotateRefreshTokenUseCase';
import { RememberTokenRepositoryPort } from '../../../domain/ports/RememberTokenRepositoryPort';
import { UserRepositoryPort } from '../../../domain/ports/UserRepositoryPort';
import { UnitOfWorkPort, TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { RememberToken } from '../../../domain/entities/RememberToken';
import { Sha256TokenHasher } from '../../security/Sha256TokenHasher';
import { getJwtSecret } from '../../security/JwtSecret';
import { accessTokenSignOptions } from '../../security/jwtOptions';
import { AUTH_COOKIE, REFRESH_COOKIE } from '../../security/cookieOptions';

class InMemoryRememberTokenRepository implements RememberTokenRepositoryPort {
  private tokens: Map<string, RememberToken> = new Map();

  async create(token: Omit<RememberToken, 'idRememberToken'>): Promise<RememberToken> {
    const created = new RememberToken(
      this.tokens.size + 1,
      token.tokenHash,
      token.idUser,
      token.expiryDate,
      token.createdAt ?? new Date(),
      token.familyId,
      token.supersededAt,
      token.successorHash,
      token.revokedAt
    );
    this.tokens.set(token.tokenHash, created);
    return created;
  }

  async findByHash(hash: string): Promise<RememberToken | null> {
    return this.tokens.get(hash) ?? null;
  }

  async deleteByHash(hash: string): Promise<boolean> {
    return this.tokens.delete(hash);
  }

  async claimRotation(input: {
    presentedHash: string;
    successorHash: string;
    tx: TransactionContext;
  }): Promise<boolean> {
    const row = this.tokens.get(input.presentedHash);
    if (!row || row.revokedAt || row.supersededAt) {
      return false;
    }
    const updated = new RememberToken(
      row.idRememberToken,
      row.tokenHash,
      row.idUser,
      row.expiryDate,
      row.createdAt,
      row.familyId,
      new Date(),
      input.successorHash,
      row.revokedAt
    );
    this.tokens.set(input.presentedHash, updated);
    return true;
  }

  async insertSuccessor(row: RememberToken, _tx: TransactionContext): Promise<RememberToken> {
    const created = new RememberToken(
      this.tokens.size + 1,
      row.tokenHash,
      row.idUser,
      row.expiryDate,
      row.createdAt ?? new Date(),
      row.familyId,
      row.supersededAt,
      row.successorHash,
      row.revokedAt
    );
    this.tokens.set(row.tokenHash, created);
    return created;
  }

  async revokeFamily(familyId: string): Promise<number> {
    let count = 0;
    for (const [hash, token] of this.tokens.entries()) {
      if (token.familyId === familyId) {
        const revoked = new RememberToken(
          token.idRememberToken,
          token.tokenHash,
          token.idUser,
          token.expiryDate,
          token.createdAt,
          token.familyId,
          token.supersededAt,
          token.successorHash,
          new Date()
        );
        this.tokens.set(hash, revoked);
        count++;
      }
    }
    return count;
  }

  async reapFamily(_familyId: string, _retentionSeconds: number, _tx: TransactionContext): Promise<number> {
    return 0;
  }
}

describe('Session revocation on logout — public HTTP interface', () => {
  let app: Express;
  let repo: InMemoryRememberTokenRepository;
  let tokenHasher: Sha256TokenHasher;

  beforeEach(() => {
    repo = new InMemoryRememberTokenRepository();
    tokenHasher = new Sha256TokenHasher();

    const uow: UnitOfWorkPort = {
      runInTransaction: async (work) => work({} as TransactionContext),
    };

    const mockUserRepo: UserRepositoryPort = {
      findById: jest.fn().mockResolvedValue({
        idUser: 1,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        image: null,
        idRole: 2,
        category: 'User',
      }),
      findByEmail: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    };

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const rotateRefreshTokenUseCase = new RotateRefreshTokenUseCase(uow, repo, tokenHasher, 86400);
    const refreshSessionUseCase = new RefreshSessionUseCase(
      repo,
      mockUserRepo,
      tokenHasher,
      rotateRefreshTokenUseCase,
      logger
    );
    const revokeRefreshTokenUseCase = new RevokeRefreshTokenUseCase(repo, tokenHasher);

    const controller = new UserApiController(
      jest.fn() as any,
      jest.fn() as any,
      jest.fn() as any,
      jest.fn() as any,
      jest.fn() as any,
      refreshSessionUseCase,
      revokeRefreshTokenUseCase
    );

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.post('/api/users/logout', controller.logout);
    app.post('/api/users/refresh', controller.refresh);
    app.post('/api/users/refresh/revoke', controller.revokeRefresh);
  });

  it('proves the revoke endpoint invalidates the refresh family when no access cookie is present, disallowing subsequent refresh', async () => {
    // -------------------------------------------------------------------------
    // Counterpart (intended behavior): with the access-token cookie present,
    // logout successfully extracts familyId and revokes the family, so a
    // subsequent refresh attempt with that family's refresh token fails (401).
    // -------------------------------------------------------------------------
    const counterpartFamily = 'family-counterpart';
    const counterpartPlainRefreshToken = 'counterpart-refresh-token-xyz';
    await repo.create({
      tokenHash: tokenHasher.hash(counterpartPlainRefreshToken),
      idUser: 1,
      expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      createdAt: new Date(),
      familyId: counterpartFamily,
    });

    const counterpartAccessToken = jwt.sign(
      { userId: 1, email: 'test@example.com', familyId: counterpartFamily, typ: 'access' },
      getJwtSecret(),
      accessTokenSignOptions('30m')
    );

    const counterpartLogoutRes = await request(app)
      .post('/api/users/logout')
      .set('Cookie', `${AUTH_COOKIE}=${counterpartAccessToken}`);

    expect(counterpartLogoutRes.status).toBe(204);

    const counterpartRefreshRes = await request(app)
      .post('/api/users/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${counterpartPlainRefreshToken}`);

    expect(counterpartRefreshRes.status).toBe(401);

    // -------------------------------------------------------------------------
    // Revocation endpoint closes the gap when no access-token cookie is present:
    // When an access-token cookie is absent (e.g. expired, dropped, or separate
    // client call), calling /api/users/refresh/revoke invalidates the refresh
    // family server-side, so a subsequent refresh attempt fails (401).
    // -------------------------------------------------------------------------
    const gapFamily = 'family-gap';
    const gapPlainRefreshToken = 'gap-refresh-token-123';
    await repo.create({
      tokenHash: tokenHasher.hash(gapPlainRefreshToken),
      idUser: 1,
      expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      createdAt: new Date(),
      familyId: gapFamily,
    });

    const gapRevokeRes = await request(app)
      .post('/api/users/refresh/revoke')
      .set('Cookie', `${REFRESH_COOKIE}=${gapPlainRefreshToken}`);
    expect(gapRevokeRes.status).toBe(204);

    const gapLogoutRes = await request(app).post('/api/users/logout');
    expect(gapLogoutRes.status).toBe(204);

    // Subsequent refresh with the same refresh token must NOT succeed (401)
    const gapRefreshRes = await request(app)
      .post('/api/users/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${gapPlainRefreshToken}`);

    expect(gapRefreshRes.status).toBe(401);
  });

  it('pins documented tolerance: cookieless logout alone does NOT revoke the refresh family', async () => {
    // -------------------------------------------------------------------------
    // Documented tolerance (S5): logout alone with no access cookie succeeds
    // (204) and clears cookies client-side, but does NOT revoke the family
    // server-side (since it has no token from which to extract familyId).
    // A subsequent refresh with the surviving refresh token still succeeds (200).
    // Future changes cannot claim cookieless logout alone revokes.
    // -------------------------------------------------------------------------
    const toleratedFamily = 'family-tolerated-gap';
    const toleratedPlainRefreshToken = 'tolerated-refresh-token-456';
    await repo.create({
      tokenHash: tokenHasher.hash(toleratedPlainRefreshToken),
      idUser: 1,
      expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      createdAt: new Date(),
      familyId: toleratedFamily,
    });

    const logoutRes = await request(app).post('/api/users/logout');
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app)
      .post('/api/users/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${toleratedPlainRefreshToken}`);

    expect(refreshRes.status).toBe(200);
  });

  it('is idempotent and never an oracle: returns 204 with empty body regardless of token existence or revocation state (S4)', async () => {
    // 1. Valid active token
    const validToken = 'valid-token-abc';
    await repo.create({
      tokenHash: tokenHasher.hash(validToken),
      idUser: 1,
      expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      createdAt: new Date(),
      familyId: 'family-valid',
    });
    const resValid = await request(app)
      .post('/api/users/refresh/revoke')
      .set('Cookie', `${REFRESH_COOKIE}=${validToken}`);
    expect(resValid.status).toBe(204);
    expect(resValid.body).toEqual({});

    // 2. Already-revoked token
    const revokedToken = 'revoked-token-def';
    await repo.create({
      tokenHash: tokenHasher.hash(revokedToken),
      idUser: 1,
      expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      createdAt: new Date(),
      familyId: 'family-revoked',
      revokedAt: new Date(),
    });
    const resRevoked = await request(app)
      .post('/api/users/refresh/revoke')
      .set('Cookie', `${REFRESH_COOKIE}=${revokedToken}`);
    expect(resRevoked.status).toBe(204);
    expect(resRevoked.body).toEqual({});

    // 3. Unknown token (not in repository)
    const resUnknown = await request(app)
      .post('/api/users/refresh/revoke')
      .set('Cookie', `${REFRESH_COOKIE}=unknown-token-xyz`);
    expect(resUnknown.status).toBe(204);
    expect(resUnknown.body).toEqual({});

    // 4. Absent token (no cookie sent)
    const resAbsent = await request(app).post('/api/users/refresh/revoke');
    expect(resAbsent.status).toBe(204);
    expect(resAbsent.body).toEqual({});

    // S4 header invariants: headers must not disclose token presence or status (no-oracle)
    expect(resValid.headers['set-cookie']).toBeDefined();
    expect(resValid.headers['set-cookie']).toEqual(resRevoked.headers['set-cookie']);
    expect(resRevoked.headers['set-cookie']).toEqual(resUnknown.headers['set-cookie']);
    expect(resUnknown.headers['set-cookie']).toEqual(resAbsent.headers['set-cookie']);
    expect(resValid.headers['content-type']).toBeUndefined();
    expect(resValid.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('m3d_auth=;'),
        expect.stringContaining('m3d_refresh=;'),
        expect.stringContaining('m3d_csrf=;'),
        expect.stringContaining('m3d_user=;'),
      ])
    );
  });

  it('preserves tolerant logout behavior: succeeds (204) with absent, expired, or invalid access cookie (S5)', async () => {
    // 1. Absent access cookie
    const resAbsent = await request(app).post('/api/users/logout');
    expect(resAbsent.status).toBe(204);

    // 2. Expired access cookie
    const expiredToken = jwt.sign(
      { userId: 1, email: 'test@example.com', familyId: 'family-exp', typ: 'access' },
      getJwtSecret(),
      accessTokenSignOptions('0s')
    );
    const resExpired = await request(app)
      .post('/api/users/logout')
      .set('Cookie', `${AUTH_COOKIE}=${expiredToken}`);
    expect(resExpired.status).toBe(204);

    // 3. Invalid/garbage access cookie
    const resInvalid = await request(app)
      .post('/api/users/logout')
      .set('Cookie', `${AUTH_COOKIE}=not-a-valid-jwt`);
    expect(resInvalid.status).toBe(204);
  });

  it('does not report success when a repository failure occurs during revocation (S6)', async () => {
    jest.spyOn(repo, 'findByHash').mockRejectedValueOnce(new Error('Database unavailable'));

    const res = await request(app)
      .post('/api/users/refresh/revoke')
      .set('Cookie', `${REFRESH_COOKIE}=db-fail-token`);

    expect(res.status).not.toBe(204);
    expect(res.status).toBe(500);
  });

  it('fails closed instead of reporting success when the revoke use case is not injected', async () => {
    const controllerWithoutRevoke = new UserApiController(jest.fn() as any, jest.fn() as any, jest.fn() as any);
    const isolatedApp = express();
    isolatedApp.use(express.json());
    isolatedApp.use(cookieParser());
    isolatedApp.post('/api/users/refresh/revoke', controllerWithoutRevoke.revokeRefresh);

    const response = await request(isolatedApp)
      .post('/api/users/refresh/revoke')
      .set('Cookie', `${REFRESH_COOKIE}=any-token`);

    expect(response.status).toBe(500);
  });
});
