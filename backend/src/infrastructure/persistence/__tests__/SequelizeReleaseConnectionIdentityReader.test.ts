import type { Sequelize } from 'sequelize';
import { SequelizeReleaseConnectionIdentityReader } from '../SequelizeReleaseConnectionIdentityReader';

const tx = { marker: 'tx' } as never;

function connectionWith(
  handlers: Array<() => unknown>,
): { reader: SequelizeReleaseConnectionIdentityReader; queue: Array<() => unknown> } {
  const queue = [...handlers];
  const connection = {
    query: async () => {
      const next = queue.shift();
      if (!next) throw new Error('unexpected query');
      return next();
    },
  } as unknown as Sequelize;
  return { reader: new SequelizeReleaseConnectionIdentityReader(connection), queue };
}

describe('SequelizeReleaseConnectionIdentityReader', () => {
  it('returns the live connection id and server uuid inside the supplied transaction', async () => {
    const { reader, queue } = connectionWith([() => [[{ id: 12, uuid: 'uuid-1' }], []]]);
    await expect(reader.snapshot(tx)).resolves.toEqual({
      connectionId: '12',
      serverUuid: 'uuid-1',
    });
    expect(queue).toHaveLength(0);
  });

  it('fails closed when the identity query returns nothing usable', async () => {
    const { reader } = connectionWith([() => [[], []]]);
    await expect(reader.snapshot(tx)).rejects.toThrow('Connection identity is unavailable');
  });
});
