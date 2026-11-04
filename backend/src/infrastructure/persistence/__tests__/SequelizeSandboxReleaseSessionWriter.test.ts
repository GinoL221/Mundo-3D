import { UniqueConstraintError } from 'sequelize';
import { SequelizeSandboxReleaseSessionWriter } from '../SequelizeSandboxReleaseSessionWriter';
import type { SandboxReleaseIdentity } from '../../../domain/ports/AuthoritativeReleaseStateReaderPort';
import { ReleaseOperationAlreadyCommittedException } from '../../../domain/exceptions/ReleaseOperationAlreadyCommittedException';

const identity: SandboxReleaseIdentity = {
  releaseId: '33333333-3333-3333-3333-333333333333',
  slotId: 'slot-a',
  leaseId: '22222222-2222-2222-2222-222222222222',
  generation: 3,
  attemptId: '11111111-1111-1111-1111-111111111111',
  seedVersion: 'v1',
};

type QueryLog = Array<{ sql: string; options?: unknown }>;

function connectionWith(
  handlers: Array<(sql: string, options?: unknown) => unknown>,
): { writer: SequelizeSandboxReleaseSessionWriter; log: QueryLog } {
  const log: QueryLog = [];
  const queue = [...handlers];
  const connection = {
    query: async (sql: string, options?: unknown) => {
      log.push({ sql, options });
      const next = queue.shift();
      if (!next) throw new Error(`unexpected query: ${sql}`);
      return next(sql, options);
    },
  };
  return {
    writer: new SequelizeSandboxReleaseSessionWriter(connection as never, 'slot-a'),
    log,
  };
}

describe('SequelizeSandboxReleaseSessionWriter', () => {
  it('captures connection identity on its own connection and inserts with bound parameters', async () => {
    const { writer, log } = connectionWith([
      () => [[{ id: 12, uuid: 'uuid-1' }], []],
      () => [[], []],
    ]);
    const recorded = await writer.recordSession(identity);
    expect(recorded).toEqual({
      attemptId: identity.attemptId,
      slotId: identity.slotId,
      generation: identity.generation,
      serverUuid: 'uuid-1',
      connectionId: '12',
    });
    expect(log).toHaveLength(2);
    expect(log[0].sql).toContain('CONNECTION_ID()');
    expect(log[0].sql).toContain('@@server_uuid');
    expect(log[1].sql).toContain('INSERT INTO');
    expect(log[1].sql).not.toContain(identity.attemptId);
    expect(log[1].sql).not.toContain(identity.slotId);
    expect(log[1].options).toMatchObject({
      replacements: expect.objectContaining({
        attemptId: identity.attemptId,
        slotId: identity.slotId,
        generation: identity.generation,
        connectionId: 12,
      }),
    });
  });

  it('rejects a foreign slot before any query', async () => {
    const { writer, log } = connectionWith([]);
    await expect(writer.recordSession({ ...identity, slotId: 'slot-b' })).rejects.toThrow(
      'Session slot mismatch',
    );
    expect(log).toHaveLength(0);
  });

  it('records another attempt of the bound slot; identity mismatches are reconciliation concerns', async () => {
    const { writer } = connectionWith([
      () => [[{ id: 13, uuid: 'uuid-2' }], []],
      () => [[], []],
    ]);
    const recorded = await writer.recordSession({
      ...identity,
      attemptId: '99999999-9999-9999-9999-999999999999',
      generation: 9,
    });
    expect(recorded).toMatchObject({
      attemptId: '99999999-9999-9999-9999-999999999999',
      generation: 9,
      connectionId: '13',
    });
  });

  it('maps an attempt-session uniqueness rejection to the domain exception', async () => {
    const { writer } = connectionWith([
      () => [[{ id: 12, uuid: 'uuid-1' }], []],
      () => {
        throw new UniqueConstraintError({ fields: { uq_release_session_attempt: '1' } });
      },
    ]);
    await expect(writer.recordSession(identity)).rejects.toBeInstanceOf(
      ReleaseOperationAlreadyCommittedException,
    );
  });

  it('rethrows an unidentifiable uniqueness violation unchanged', async () => {
    const original = new UniqueConstraintError({ fields: { release_id: 'x' } });
    const { writer } = connectionWith([
      () => [[{ id: 12, uuid: 'uuid-1' }], []],
      () => {
        throw original;
      },
    ]);
    await expect(writer.recordSession(identity)).rejects.toBe(original);
  });

  it('rethrows ordinary database failures unchanged', async () => {
    const failure = new Error('connection lost');
    const { writer } = connectionWith([
      () => [[{ id: 12, uuid: 'uuid-1' }], []],
      () => {
        throw failure;
      },
    ]);
    await expect(writer.recordSession(identity)).rejects.toBe(failure);
  });

  it('fails closed when the connection identity query returns nothing usable', async () => {
    const { writer, log } = connectionWith([() => [[], []]]);
    await expect(writer.recordSession(identity)).rejects.toThrow(
      'Connection identity is unavailable',
    );
    expect(log).toHaveLength(1);
  });
});
