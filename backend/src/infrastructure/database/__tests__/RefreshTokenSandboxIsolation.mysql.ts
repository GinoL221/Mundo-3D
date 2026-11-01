import { QueryTypes, Sequelize } from 'sequelize';
import { runRefreshTokenIsolationScenarios } from './refreshTokenIsolationScenarios';
import { createScopedRefreshTokenAdapters } from './refreshTokenIsolationFixture';
import type { RememberTokenPersistence } from '../../repositories/ScopedSequelizeRememberTokenRepository';
import defineRememberToken from '../../../database/models/RememberToken';
import { RememberToken } from '../../../domain/entities/RememberToken';

jest.mock('../../../database/models/db', () => {
  throw new Error('Sandbox integration must not load the global database');
});
jest.mock('dotenv', () => {
  throw new Error('Sandbox integration must not load .env');
});

const opened: Sequelize[] = [];

function getCreds() {
  const fs = require('fs');
  const path = '/home/ginopc/Desarrollo/Mundo-3D-worktrees/demo-sandbox-stage1/odd/verification/disposable-run/.db_creds.json';
  if (!fs.existsSync(path)) throw new Error('Missing disposable db credentials file');
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function makeConnection(database: string, user: string, pass: string): Sequelize {
  const creds = getCreds();
  const conn = new Sequelize(database, user, pass, {
    dialect: 'mysql',
    host: creds.host,
    port: creds.port,
    logging: false,
    pool: { min: 0, max: 1 },
    retry: { max: 0 },
  });
  opened.push(conn);
  return conn;
}

afterAll(async () => {
  await Promise.allSettled(opened.map((c) => c.close()));
});

test('dedicated refresh token MySQL isolation & concurrent rotation test', async () => {
  const creds = getCreds();

  // 1. Establish connections: A primary, A concurrent (distinct connection), B primary, Control
  const connA = makeConnection(creds.slotA.database, creds.slotA.user, creds.slotA.password);
  const connAConcurrent = makeConnection(creds.slotA.database, creds.slotA.user, creds.slotA.password);
  const connB = makeConnection(creds.slotB.database, creds.slotB.user, creds.slotB.password);
  const connControl = makeConnection(creds.control.database, creds.control.user, creds.control.password);

  // 2. Validate Server UUID across all connections matches container serverUuid
  for (const conn of [connA, connAConcurrent, connB, connControl]) {
    const [res] = await conn.query<{ server_uuid: string }>('SELECT @@server_uuid AS server_uuid', { type: QueryTypes.SELECT });
    expect(res.server_uuid).toBe(creds.serverUuid);
  }

  // 3. Define models on connections
  const modelA = defineRememberToken(connA);
  const modelAConcurrent = defineRememberToken(connAConcurrent);
  const modelB = defineRememberToken(connB);

  const slotA = createScopedRefreshTokenAdapters({ sequelize: connA, RememberToken: modelA } as unknown as RememberTokenPersistence);
  const slotAConcurrent = createScopedRefreshTokenAdapters({ sequelize: connAConcurrent, RememberToken: modelAConcurrent } as unknown as RememberTokenPersistence);
  const slotB = createScopedRefreshTokenAdapters({ sequelize: connB, RememberToken: modelB } as unknown as RememberTokenPersistence);

  // 4. Seed initial records for scenarios (truncate milliseconds for MySQL DATETIME seconds precision)
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  const expiry = new Date(now.getTime() + 3600000);
  const familyId = '4f8d2e80-7b2d-4c3a-8f1e-9a0b1c2d3e4f';

  const aHash = 'a'.repeat(64);
  const bHash = 'b'.repeat(64);
  const rollbackHash = 'r'.repeat(64);
  const raceHash = 'c'.repeat(64);

  await modelA.create({
    idUser: 101,
    tokenHash: aHash,
    familyId,
    expiryDate: expiry,
    createdAt: now,
  });

  await modelB.create({
    idUser: 202,
    tokenHash: bHash,
    familyId: '5f8d2e80-7b2d-4c3a-8f1e-9a0b1c2d3e4f',
    expiryDate: expiry,
    createdAt: now,
  });

  await modelA.create({
    idUser: 101,
    tokenHash: rollbackHash,
    familyId,
    expiryDate: expiry,
    createdAt: now,
  });

  await modelA.create({
    idUser: 101,
    tokenHash: raceHash,
    familyId,
    expiryDate: expiry,
    createdAt: now,
  });

  const rollbackSuccessor = new RememberToken(0, 's_roll'.padEnd(64, '0'), 101, expiry, now, familyId);
  const raceSuccessor1 = new RememberToken(0, 's_race1'.padEnd(64, '0'), 101, expiry, now, familyId);
  const raceSuccessor2 = new RememberToken(0, 's_race2'.padEnd(64, '0'), 101, expiry, now, familyId);

  // Snapshot implementation querying physical MySQL tables
  const snapshot = async () => {
    const fetchLogical = async (conn: Sequelize) => {
      const rows = await conn.query<{
        token_hash: string;
        id_user: number;
        family_id: string | null;
        expiry_date: Date;
        superseded_at: Date | null;
        successor_hash: string | null;
        revoked_at: Date | null;
      }>('SELECT token_hash, id_user, family_id, expiry_date, superseded_at, successor_hash, revoked_at FROM RememberToken ORDER BY token_hash ASC', {
        type: QueryTypes.SELECT,
      });
      return rows.map((r) => ({
        tokenHash: r.token_hash,
        idUser: r.id_user,
        familyId: r.family_id,
        expiryDate: new Date(r.expiry_date).toISOString(),
        superseded: r.superseded_at !== null,
        successorHash: r.successor_hash,
        revoked: r.revoked_at !== null,
      }));
    };

    const rowsA = await fetchLogical(connA);
    const rowsB = await fetchLogical(connB);
    const [ctrlRows] = await connControl.query('SELECT * FROM sentinel');

    return {
      a: { rows: rowsA, counters: {} },
      b: { rows: rowsB, counters: {} },
      control: { rows: ctrlRows, counters: {} },
    };
  };

  const verifySessions = async () => {
    const [idA] = await connA.query<{ server: string; schema: string; session: number }>('SELECT @@server_uuid AS server, DATABASE() AS `schema`, CONNECTION_ID() AS session', { type: QueryTypes.SELECT });
    const [idAConc] = await connAConcurrent.query<{ server: string; schema: string; session: number }>('SELECT @@server_uuid AS server, DATABASE() AS `schema`, CONNECTION_ID() AS session', { type: QueryTypes.SELECT });

    return {
      server: idA.server,
      schema: idA.schema,
      concurrentServer: idAConc.server,
      concurrentSchema: idAConc.schema,
      session: String(idA.session),
      concurrentSession: String(idAConc.session),
      bound: true,
    };
  };

  // Run the full isolation and concurrency scenario on MySQL
  await runRefreshTokenIsolationScenarios({
    a: slotA,
    aConcurrent: slotAConcurrent,
    b: slotB,
    fixtures: {
      aHash,
      bHash,
      rollbackHash,
      raceHash,
      rollbackSuccessor,
      raceSuccessors: [raceSuccessor1, raceSuccessor2],
    },
    snapshot,
    verifySessions,
    acquisitionTimeoutMs: 10000,
  });
});
