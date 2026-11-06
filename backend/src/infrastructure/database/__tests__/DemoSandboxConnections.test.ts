import { Sequelize } from 'sequelize';
import { createDemoSandboxConnections } from '../DemoSandboxConnections';

jest.mock('sequelize', () => ({
  Sequelize: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn(),
    sync: jest.fn(),
    query: jest.fn(),
    close: jest.fn(),
  })),
}));

const constructor = jest.mocked(Sequelize);
const configuration = () => ({
  host: 'sandbox.mysql.test',
  port: 3307,
  controlPlaneDatabase: 'demo_control',
  slots: [
    { slotId: 'slot-a', database: 'demo_a', username: 'demo_a_user', password: 'fixture-a' },
    { slotId: 'slot-b', database: 'demo_b', username: 'demo_b_user', password: 'fixture-b' },
  ],
});

beforeEach(() => jest.clearAllMocks());

describe('explicit demo sandbox connections', () => {
  it('constructs one separate instance per configured slot with exact explicit credentials', () => {
    const config = configuration();
    const connections = createDemoSandboxConnections(config);
    expect(constructor).toHaveBeenCalledTimes(2);
    for (const [index, slot] of config.slots.entries()) {
      expect(constructor).toHaveBeenNthCalledWith(
        index + 1,
        slot.database,
        slot.username,
        slot.password,
        {
          dialect: 'mysql',
          host: config.host,
          port: config.port,
          logging: false,
          pool: { min: 0, max: 1 },
          retry: { max: 0 },
        },
      );
    }
    expect(connections.get('slot-a')).not.toBe(connections.get('slot-b'));
    expect(connections.get('slot-a')).toBe(connections.get('slot-a'));
    expect(constructor).toHaveBeenCalledTimes(2);
    for (const slot of config.slots) {
      const connection = connections.get(slot.slotId);
      expect(connection.authenticate).not.toHaveBeenCalled();
      expect(connection.sync).not.toHaveBeenCalled();
      expect(connection.query).not.toHaveBeenCalled();
    }
  });

  it('rejects incomplete or unsafe configuration before constructing any instances', () => {
    const invalid = [
      { ...configuration(), host: '' },
      { ...configuration(), port: 0 },
      { ...configuration(), port: 65536 },
      { ...configuration(), port: 3306.5 },
      { ...configuration(), controlPlaneDatabase: '' },
      { ...configuration(), slots: [] },
      ...['slotId', 'database', 'username', 'password'].map((key) => {
        const config = configuration();
        return { ...config, slots: [config.slots[0], { ...config.slots[1], [key]: '' }] };
      }),
      ...[
        'demo_control',
        'DEMO_CONTROL',
        'mysql',
        'information_schema',
        'performance_schema',
        'sys',
      ].map((database) => {
        const config = configuration();
        return { ...config, slots: [config.slots[0], { ...config.slots[1], database }] };
      }),
      ...['root', 'ROOT'].map((username) => {
        const config = configuration();
        return { ...config, slots: [config.slots[0], { ...config.slots[1], username }] };
      }),
      ...['slotId', 'database', 'username'].map((key) => {
        const config = configuration();
        return {
          ...config,
          slots: [
            config.slots[0],
            { ...config.slots[1], [key]: ` ${config.slots[1][key as 'slotId']} ` },
          ],
        };
      }),
    ];
    for (const config of invalid) {
      expect(() => createDemoSandboxConnections(config)).toThrow(
        'Invalid demo sandbox connection configuration',
      );
      expect(constructor).not.toHaveBeenCalled();
    }
  });

  it('rejects reused slot ids, databases or accounts before constructing any instances', () => {
    for (const key of ['slotId', 'database', 'username'] as const) {
      const config = configuration();
      config.slots[1][key] = config.slots[0][key];
      expect(() => createDemoSandboxConnections(config)).toThrow(
        'Invalid demo sandbox connection configuration',
      );
      expect(constructor).not.toHaveBeenCalled();
    }
  });

  it('rejects unknown slots without creating connections or falling back to the environment database', () => {
    const config = configuration();
    const connections = createDemoSandboxConnections(config);
    config.slots[0].slotId = 'injected-slot';
    config.slots[0].database = 'injected-db';
    for (const unknown of ['missing-slot', '', 'injected-slot', ' slot-a ']) {
      expect(() => connections.get(unknown)).toThrow('Demo sandbox connection is not configured');
    }
    expect(constructor).toHaveBeenCalledTimes(2);
    expect(connections.get('slot-a')).toBeDefined();
  });
});
