import { QueryTypes, Sequelize } from 'sequelize';
import { createDemoSandboxReleaseSessionModel } from '../../../database/models/DemoSandboxReleaseSession';
import { ScopedSequelizeUnitOfWork } from '../../persistence/ScopedSequelizeUnitOfWork';
import { SequelizeSandboxReleaseSessionWriter } from '../../persistence/SequelizeSandboxReleaseSessionWriter';
import { SequelizeReleaseConnectionIdentityReader } from '../../persistence/SequelizeReleaseConnectionIdentityReader';
import { CoordinateSandboxRelease } from '../CoordinateSandboxRelease';
import type { SandboxReleaseIdentity } from '../../../domain/ports/AuthoritativeReleaseStateReaderPort';

jest.mock('../../../database/models/db', () => {
  throw new Error('Sandbox integration must not load the global database');
});
jest.mock('dotenv', () => {
  throw new Error('Sandbox integration must not load .env');
});

const container = 'm3d-sandbox-isolation-01a10377';
const database = 'm3d_sandbox_verify_pinning';
const opened: Sequelize[] = [];

function configuration() {
  const required = {
    M3D_SANDBOX_TEST_AUTHORIZATION: container,
    M3D_SANDBOX_TEST_HOST: '127.0.0.1',
    M3D_SANDBOX_TEST_PORT: '33316',
    M3D_SANDBOX_TEST_PINNING_DATABASE: database,
  };
  for (const [key, expected] of Object.entries(required)) {
    if (process.env[key] !== expected) {
      throw new Error(`Explicit disposable sandbox configuration required: ${key}`);
    }
  }
  const adminPassword = process.env.M3D_SANDBOX_TEST_ADMIN_PASSWORD;
  if (!adminPassword || !/^[a-f0-9]{64}$/.test(adminPassword)) {
    throw new Error('Fresh sandbox admin password must be supplied explicitly');
  }
  const uuid = process.env.M3D_SANDBOX_TEST_SERVER_UUID;
  if (!uuid || !/^[a-f0-9-]{36}$/.test(uuid)) {
    throw new Error('Explicit disposable sandbox server UUID required');
  }
  return { adminPassword, uuid };
}

function connection(password: string, databaseName?: string, poolMax = 1): Sequelize {
  const instance = new Sequelize(databaseName ?? '', 'root', password, {
    dialect: 'mysql',
    host: '127.0.0.1',
    port: 33316,
    logging: false,
    pool: { min: 0, max: poolMax, acquire: 1500, idle: 10000 },
    retry: { max: 0 },
  });
  opened.push(instance);
  return instance;
}

const identity: SandboxReleaseIdentity = {
  releaseId: '33333333-3333-3333-3333-333333333333',
  slotId: 'slot-a',
  leaseId: '22222222-2222-2222-2222-222222222222',
  generation: 3,
  attemptId: '11111111-1111-1111-1111-111111111111',
  seedVersion: 'v1',
};

const foreignIdentity: SandboxReleaseIdentity = {
  ...identity,
  releaseId: '44444444-4444-4444-4444-444444444444',
  attemptId: '55555555-5555-5555-5555-555555555555',
};

const rollbackIdentity: SandboxReleaseIdentity = {
  ...identity,
  releaseId: '66666666-6666-6666-6666-666666666666',
  attemptId: '77777777-7777-7777-7777-777777777777',
};

let adminPassword: string;
let serverUuid: string;

beforeAll(async () => {
  ({ adminPassword, uuid: serverUuid } = configuration());
  const bootstrap = connection(adminPassword);
  await bootstrap.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await bootstrap.query(`CREATE DATABASE \`${database}\``);
  await bootstrap.close();
  opened.length = 0;
  const schema = connection(adminPassword, database);
  await createDemoSandboxReleaseSessionModel(schema).sync();
  await schema.query(
    'CREATE TABLE `DemoSandboxReleaseOperation` (`release_id` CHAR(36) BINARY NOT NULL PRIMARY KEY, `slot_id` VARCHAR(64) NOT NULL, `generation` INTEGER UNSIGNED NOT NULL, `attempt_id` CHAR(36) BINARY NOT NULL, `seed_version` VARCHAR(128) NOT NULL, `lease_id` CHAR(36) BINARY NOT NULL, UNIQUE KEY `uq_release_attempt` (`slot_id`, `generation`, `attempt_id`)) ENGINE=InnoDB',
  );
  await schema.close();
  opened.length = 0;
});

afterAll(async () => {
  await Promise.all(opened.splice(0).map((instance) => instance.close()));
});

describe('release pinning on a disposable MySQL server', () => {
  it('reuses one MySQL thread id across sequential checkouts on a max:1 pool', async () => {
    const slot = connection(adminPassword, database);
    const ids: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const rows = (await slot.query('SELECT CONNECTION_ID() AS id', { type: QueryTypes.SELECT })) as Array<{ id: number }>;
      ids.push(rows[0].id);
    }
    expect(new Set(ids).size).toBe(1);
  });

  it('keeps the recorded session identity stable from recording through the release transaction', async () => {
    const slot = connection(adminPassword, database);
    const writer = new SequelizeSandboxReleaseSessionWriter(slot, identity.slotId);
    const recorded = await writer.recordSession(identity);

    const identityReader = new SequelizeReleaseConnectionIdentityReader(slot);
    const uow = new ScopedSequelizeUnitOfWork(slot);
    const live = await uow.runInTransaction((tx) => identityReader.snapshot(tx));
    expect(live.connectionId).toBe(recorded.connectionId);
    expect(live.serverUuid).toBe(recorded.serverUuid);
    expect(recorded.serverUuid).toBe(serverUuid);

    // The coordinator guard accepts the same-connection transaction.
    const coordinator = new CoordinateSandboxRelease({
      uow,
      sessions: { recordSession: jest.fn(async () => recorded) },
      connectionId: identityReader,
      control: { lockAndCheck: jest.fn(async () => true), release: jest.fn(async () => true) },
      fence: { lockAndCheck: jest.fn(async () => true) },
      receipts: { consume: jest.fn(async () => true) },
      releaseRecorder: { record: jest.fn(async () => undefined), exists: jest.fn(async () => false) },
      reader: { readState: jest.fn(async () => null) },
    });
    await expect(coordinator.execute(identity)).resolves.toMatchObject({
      outcome: 'released',
      recorded,
    });
  });

  it('reports uncertain when the transaction runs on a foreign connection', async () => {
    const slot = connection(adminPassword, database);
    const foreign = connection(adminPassword, database);
    const writer = new SequelizeSandboxReleaseSessionWriter(foreign, identity.slotId);
    const recordedForeign = await writer.recordSession(foreignIdentity);

    const identityReader = new SequelizeReleaseConnectionIdentityReader(slot);
    const control = { lockAndCheck: jest.fn(), release: jest.fn() };
    const fence = { lockAndCheck: jest.fn() };
    const receipts = { consume: jest.fn() };
    const releaseRecorder = { record: jest.fn(), exists: jest.fn(async () => false) };
    const coordinator = new CoordinateSandboxRelease({
      uow: new ScopedSequelizeUnitOfWork(slot),
      sessions: { recordSession: jest.fn(async () => recordedForeign) },
      connectionId: identityReader,
      control,
      fence,
      receipts,
      releaseRecorder,
      reader: { readState: jest.fn() },
    });
    await expect(coordinator.execute(identity)).resolves.toMatchObject({ outcome: 'uncertain' });
    // The continuity guard fired: no lifecycle port ran on the foreign session.
    expect(control.lockAndCheck).not.toHaveBeenCalled();
    expect(fence.lockAndCheck).not.toHaveBeenCalled();
    expect(receipts.consume).not.toHaveBeenCalled();
    expect(releaseRecorder.record).not.toHaveBeenCalled();
    const sessionRows = (await slot.query(
      'SELECT COUNT(*) AS n FROM DemoSandboxReleaseSession WHERE attempt_id = ?',
      { replacements: [foreignIdentity.attemptId], type: QueryTypes.SELECT },
    )) as Array<{ n: number }>;
    expect(Number(sessionRows[0].n)).toBe(1);
  });

  it('rolls the release transaction back when its raw connection is killed mid-transaction', async () => {
    const admin = connection(adminPassword);
    const victim = connection(adminPassword, database);
    const victimId = ((await victim.query('SELECT CONNECTION_ID() AS id', { type: QueryTypes.SELECT })) as Array<{ id: number }>)[0].id;
    await expect(
      victim.transaction(async (tx) => {
        await victim.query(
          'INSERT INTO DemoSandboxReleaseOperation (release_id, slot_id, generation, attempt_id, seed_version, lease_id) VALUES (?, ?, ?, ?, ?, ?)',
          {
            replacements: [
              rollbackIdentity.releaseId,
              rollbackIdentity.slotId,
              rollbackIdentity.generation,
              rollbackIdentity.attemptId,
              rollbackIdentity.seedVersion,
              rollbackIdentity.leaseId,
            ],
            transaction: tx,
          },
        );
        await admin.query(`KILL ${victimId}`);
        await victim.query('SELECT 1', { transaction: tx });
      }),
    ).rejects.toThrow();
    const releaseRows = (await admin.query(
      `SELECT COUNT(*) AS n FROM \`${database}\`.DemoSandboxReleaseOperation`,
      { type: QueryTypes.SELECT },
    )) as Array<{ n: number }>;
    expect(Number(releaseRows[0].n)).toBe(0);
    await admin.close();
  });
});
