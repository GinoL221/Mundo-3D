import { Sequelize } from 'sequelize';
import {
  SequelizeAuthoritativeReleaseStateReader,
  type RecordedReleaseSession,
} from '../SequelizeAuthoritativeReleaseStateReader';
import type { SandboxReleaseIdentity } from '../../../domain/ports/AuthoritativeReleaseStateReaderPort';

const identity: SandboxReleaseIdentity = {
  releaseId: '33333333-3333-3333-3333-333333333333',
  slotId: 'slot-a',
  leaseId: '22222222-2222-2222-2222-222222222222',
  generation: 3,
  attemptId: '11111111-1111-1111-1111-111111111111',
  seedVersion: 'v1',
};

const session: RecordedReleaseSession = {
  attemptId: identity.attemptId,
  slotId: identity.slotId,
  generation: identity.generation,
  serverUuid: 'uuid-before-restart',
  connectionId: '12',
};

type QueryLog = Array<{ sql: string; options?: unknown }>;

interface Harness {
  reader: SequelizeAuthoritativeReleaseStateReader;
  log: QueryLog;
  connection: Sequelize;
  queue: Array<(sql: string) => unknown>;
}

function connectionWith(handlers: Array<(sql: string) => unknown>): Harness {
  const log: QueryLog = [];
  const queue = [...handlers];
  const connection = {
    transaction: async (work: (tx: object) => Promise<unknown>) =>
      work({ marker: 'tx' }),
    query: async (sql: string, options?: unknown) => {
      log.push({ sql, options });
      const next = queue.shift();
      if (!next) throw new Error(`unexpected query: ${sql}`);
      return next(sql);
    },
  } as unknown as Sequelize;
  return {
    reader: new SequelizeAuthoritativeReleaseStateReader(connection, 'slot-a'),
    log,
    connection,
    queue,
  };
}

const isSelect = (fragment: string) => (sql: string) => sql.includes(fragment);

const releaseRow = {
  release_id: identity.releaseId,
  slot_id: identity.slotId,
  generation: identity.generation,
  attempt_id: identity.attemptId,
  seed_version: identity.seedVersion,
  lease_id: identity.leaseId,
};

describe('SequelizeAuthoritativeReleaseStateReader', () => {
  it('indeterminate when the recorded session belongs to a different server identity', async () => {
    const { reader } = connectionWith([
      () => [[{ current: 'uuid-after-restart' }], []],
      () => [[], []],
      () => [[], []],
      () => [[], []],
      () => [[], []],
    ]);
    await expect(reader.readState(identity, session)).resolves.toBeNull();
  });

  it('indeterminate while the recorded connection id is still present', async () => {
    const { reader } = connectionWith([
      () => [[{ current: session.serverUuid }], []],
      () => [[{ ID: Number(session.connectionId) }], []],
    ]);
    await expect(reader.readState(identity, session)).resolves.toBeNull();
  });

  it('indeterminate when the process list is unreadable', async () => {
    const { reader } = connectionWith([
      () => [[{ current: session.serverUuid }], []],
      () => {
        throw new Error('PROCESSLIST denied');
      },
    ]);
    await expect(reader.readState(identity, session)).resolves.toBeNull();
  });

  it('locks control before fence, matching the release transaction order', async () => {
    const { reader, log } = connectionWith([
      () => [[{ current: session.serverUuid }], []],
      () => [[], []],
      () => [
        [{
          slot_id: identity.slotId,
          status: 'available',
          generation: identity.generation + 1,
          lease_id: null,
          reset_attempt_id: null,
        }],
        [],
      ],
      () => [
        [{
          slot_id: identity.slotId,
          state: 'open',
          generation: identity.generation + 1,
          lease_id: null,
          reset_attempt_id: null,
        }],
        [],
      ],
      () => [
        [{
          slot_id: identity.slotId,
          generation: identity.generation,
          attempt_id: identity.attemptId,
          seed_version: identity.seedVersion,
          consumed: 1,
        }],
        [],
      ],
      () => [[releaseRow], []],
    ]);
    const state = await reader.readState(identity, session);
    expect(state).not.toBeNull();
    expect(state?.transactionEnded).toBe(true);
    expect(state?.authoritativeSnapshot).toBe(true);
    expect(state?.releaseEvidence).toEqual({ identity, outcome: 'committed' });
    expect(state?.fence?.state).toBe('open');
    expect(state?.control?.status).toBe('available');
    expect(state?.receipt?.consumed).toBe(true);
    expect(log[0].sql).toContain('@@server_uuid');
    expect(log[1].sql).toContain('PROCESSLIST');
    expect(log[0].options).toBeUndefined();
    expect(log[2].sql).toContain('FOR UPDATE');
    expect(log[2].sql).toContain('DemoSandboxSlot');
    expect(log[3].sql).toContain('DemoSandboxFence');
    expect(log[3].sql).toContain('FOR UPDATE');
    expect(log[2].options).toMatchObject({ transaction: { marker: 'tx' } });
  });

  it('reports not_committed evidence when the release row is absent', async () => {
    const { reader } = connectionWith([
      () => [[{ current: session.serverUuid }], []],
      () => [[], []],
      () => [
        [{
          slot_id: identity.slotId,
          status: 'resetting',
          generation: identity.generation,
          lease_id: identity.leaseId,
          reset_attempt_id: identity.attemptId,
        }],
        [],
      ],
      () => [
        [{
          slot_id: identity.slotId,
          state: 'fenced',
          generation: identity.generation,
          lease_id: null,
          reset_attempt_id: identity.attemptId,
        }],
        [],
      ],
      () => [
        [{
          slot_id: identity.slotId,
          generation: identity.generation,
          attempt_id: identity.attemptId,
          seed_version: identity.seedVersion,
          consumed: 0,
        }],
        [],
      ],
      () => [[], []],
    ]);
    const state = await reader.readState(identity, session);
    expect(state?.releaseEvidence).toEqual({ identity, outcome: 'not_committed' });
  });

  it.each([
    ['release_id', 'another-release'],
    ['slot_id', 'another-slot'],
    ['generation', 4],
    ['attempt_id', 'another-attempt'],
    ['seed_version', 'V1'],
    ['lease_id', 'another-lease'],
  ])('refuses durable evidence with mismatched %s', async (field, value) => {
    const { reader } = connectionWith([
      () => [[{ current: session.serverUuid }], []],
      () => [[], []],
      () => [[], []],
      () => [[], []],
      () => [[], []],
      () => [[{ ...releaseRow, [field]: value }], []],
    ]);
    await expect(reader.readState(identity, session)).resolves.toBeNull();
  });

  it('refuses malformed nested durable evidence rather than treating presence as proof', async () => {
    const { reader } = connectionWith([
      () => [[{ current: session.serverUuid }], []],
      () => [[], []],
      () => [[], []],
      () => [[], []],
      () => [[], []],
      () => [[[releaseRow]], []],
    ]);
    await expect(reader.readState(identity, session)).resolves.toBeNull();
  });

  it('rejects a foreign session record before any query', async () => {
    const { reader, log } = connectionWith([]);
    await expect(
      reader.readState(identity, { ...session, attemptId: 'other' }),
    ).resolves.toBeNull();
    await expect(
      reader.readState(identity, { ...session, slotId: 'slot-b' }),
    ).resolves.toBeNull();
    await expect(
      reader.readState(identity, { ...session, generation: 9 }),
    ).resolves.toBeNull();
    expect(log).toHaveLength(0);
  });

  it('indeterminate when a lifecycle read fails inside the fresh transaction', async () => {
    const { reader } = connectionWith([
      () => [[{ current: session.serverUuid }], []],
      () => [[], []],
      () => {
        throw new Error('read failed');
      },
    ]);
    await expect(reader.readState(identity, session)).resolves.toBeNull();
  });

  it('refuses a session bound to another slot before any query', async () => {
    const { reader, log } = connectionWith([]);
    await expect(reader.readState(identity, { ...session, slotId: 'slot-b' })).resolves.toBeNull();
    expect(log).toHaveLength(0);
  });

  it('checks the fence row of its bound slot only', async () => {
    const { reader, log } = connectionWith([
      () => [[{ current: session.serverUuid }], []],
      () => [[], []],
      () => [[], []],
      () => [[], []],
      () => [[], []],
      () => [[], []],
    ]);
    await reader.readState(identity, session);
    const fenceQuery = log.find(({ sql }) => sql.includes('DemoSandboxFence'));
    expect(fenceQuery?.sql).toContain("slot_id = 'slot-a'");
  });
});
