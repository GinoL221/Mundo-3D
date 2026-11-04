import type { Sequelize } from 'sequelize';
import { SequelizeReleaseConnectionIdentityReader } from '../SequelizeReleaseConnectionIdentityReader';

const tx = { marker: 'tx' } as never;

function connectionWith(handlers: Array<() => unknown>): {
  reader: SequelizeReleaseConnectionIdentityReader;
  queue: Array<() => unknown>;
  log: Array<{ sql: string; options?: unknown }>;
} {
  const queue = [...handlers];
  const log: Array<{ sql: string; options?: unknown }> = [];
  const connection = {
    query: async (sql: string, options?: unknown) => {
      log.push({ sql, options });
      const next = queue.shift();
      if (!next) throw new Error('unexpected query');
      return next();
    },
  } as unknown as Sequelize;
  return { reader: new SequelizeReleaseConnectionIdentityReader(connection), queue, log };
}

describe('SequelizeReleaseConnectionIdentityReader', () => {
  it('returns the live connection id and server uuid inside the supplied transaction', async () => {
    const { reader, queue, log } = connectionWith([() => [[{ id: 12, uuid: 'uuid-1' }], []]]);
    await expect(reader.snapshot(tx)).resolves.toEqual({
      connectionId: '12',
      serverUuid: 'uuid-1',
    });
    expect(queue).toHaveLength(0);
    expect(log[0].options).toMatchObject({ transaction: tx });
    expect(log[0].sql).toContain('CONNECTION_ID()');
    expect(log[0].sql).toContain('@@server_uuid');
  });

  it.each([
    ['no rows', () => [[], []]],
    ['a zero id', () => [[{ id: 0, uuid: 'uuid-1' }], []]],
    ['a non-numeric id', () => [[{ id: 'thread', uuid: 'uuid-1' }], []]],
    ['an unsafe id', () => [[{ id: 1e21, uuid: 'uuid-1' }], []]],
    ['a missing uuid', () => [[{ id: 12, uuid: '' }], []]],
  ])('fails closed on %s', async (_label, handler) => {
    const { reader } = connectionWith([handler as () => unknown]);
    await expect(reader.snapshot(tx)).rejects.toThrow('Connection identity is unavailable');
  });
});
