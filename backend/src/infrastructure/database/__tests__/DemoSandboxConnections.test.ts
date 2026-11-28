import { Sequelize } from 'sequelize';
import {
  createDemoSandboxConnections,
  loadDemoSandboxConfigFromEnv,
} from '../DemoSandboxConnections';

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

  it('enables strict TLS with rejectUnauthorized=true when caCert is supplied and rejects blank caCert', () => {
    const caCert = '-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----';
    createDemoSandboxConnections({ ...configuration(), caCert });
    expect(constructor).toHaveBeenNthCalledWith(
      1,
      'demo_a',
      'demo_a_user',
      'fixture-a',
      expect.objectContaining({
        dialectOptions: { ssl: { ca: caCert, rejectUnauthorized: true } },
      }),
    );
    expect(() => createDemoSandboxConnections({ ...configuration(), caCert: '   ' })).toThrow(
      'Invalid demo sandbox connection configuration',
    );
  });

  it('closes every slot connection via closeAll and surfaces failures after attempting all closes', async () => {
    const connections = createDemoSandboxConnections(configuration());
    const slotA = connections.get('slot-a');
    const slotB = connections.get('slot-b');
    jest.mocked(slotA.close).mockRejectedValueOnce(new Error('close-a-failed'));
    jest.mocked(slotB.close).mockResolvedValueOnce(undefined);
    await expect(connections.closeAll()).rejects.toThrow('close-a-failed');
    expect(slotA.close).toHaveBeenCalledTimes(1);
    expect(slotB.close).toHaveBeenCalledTimes(1);
  });
});

describe('loadDemoSandboxConfigFromEnv', () => {
  const validSlots = [
    { slotId: 'slot-1', database: 'demo_slot_1', username: 'demo_u1', password: 'p1' },
    { slotId: 'slot-2', database: 'demo_slot_2', username: 'demo_u2', password: 'p2' },
    { slotId: 'slot-3', database: 'demo_slot_3', username: 'demo_u3', password: 'p3' },
  ];
  const baseEnv = (): NodeJS.ProcessEnv => ({
    NODE_ENV: 'production',
    JWT_SECRET: 'prod-secret-at-least-32-chars-long-0001',
    DB_HOST: 'tidb.example.test',
    DB_PORT: '4000',
    DB_NAME: 'mundo_3d_control',
    DB_CA_CERT: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----',
    DEMO_SANDBOX_ENABLED: 'true',
    DEMO_SANDBOX_JWT_SECRET: 'sandbox-only-secret-at-least-32-chars-01',
    DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(validSlots),
  });

  it('returns enabled=false when unset, empty, or "false"', () => {
    expect(loadDemoSandboxConfigFromEnv({})).toEqual({ enabled: false });
    expect(loadDemoSandboxConfigFromEnv({ DEMO_SANDBOX_ENABLED: '' })).toEqual({ enabled: false });
    expect(loadDemoSandboxConfigFromEnv({ DEMO_SANDBOX_ENABLED: 'false' })).toEqual({
      enabled: false,
    });
  });

  it('inherits DB_* defaults with recoverOnBoot=false and allows non-TLS outside production', () => {
    const inherited = loadDemoSandboxConfigFromEnv(baseEnv());
    expect(inherited).toEqual({
      enabled: true,
      jwtSecret: 'sandbox-only-secret-at-least-32-chars-01',
      recoverOnBoot: false,
      connections: {
        host: 'tidb.example.test',
        port: 4000,
        controlPlaneDatabase: 'mundo_3d_control',
        caCert: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----',
        slots: validSlots,
      },
    });
    const local = loadDemoSandboxConfigFromEnv({
      ...baseEnv(),
      NODE_ENV: 'development',
      DB_CA_CERT: '',
    });
    expect(local).toMatchObject({ enabled: true, connections: { host: 'tidb.example.test' } });
    if (local.enabled) expect(local.connections.caCert).toBeUndefined();
  });

  it('loads valid config inheriting DB_* and supports DEMO_SANDBOX_DB_* overrides', () => {
    const loaded = loadDemoSandboxConfigFromEnv({
      ...baseEnv(),
      DEMO_SANDBOX_DB_HOST: 'sandbox.tidb.test',
      DEMO_SANDBOX_DB_PORT: '4001',
      DEMO_SANDBOX_DB_CA_CERT: 'custom-ca',
      DEMO_SANDBOX_RECOVER_ON_BOOT: 'true',
    });
    expect(loaded).toEqual({
      enabled: true,
      jwtSecret: 'sandbox-only-secret-at-least-32-chars-01',
      recoverOnBoot: true,
      connections: {
        host: 'sandbox.tidb.test',
        port: 4001,
        controlPlaneDatabase: 'mundo_3d_control',
        caCert: 'custom-ca',
        slots: validSlots,
      },
    });
  });

  it('accepts an exact 32-char DEMO_SANDBOX_JWT_SECRET', () => {
    const exact32 = 'x'.repeat(32);
    const loaded = loadDemoSandboxConfigFromEnv({
      ...baseEnv(),
      DEMO_SANDBOX_JWT_SECRET: exact32,
    });
    expect(loaded).toMatchObject({ enabled: true, jwtSecret: exact32 });
  });

  it('accepts TiDB Cloud Starter prefixed slot usernames up to 32 chars', () => {
    const prefixedSlots = [
      {
        slotId: 'slot-1',
        database: 'demo_slot_1',
        username: '2abcde123456789.m3d_s1',
        password: 'p1',
      },
      {
        slotId: 'slot-2',
        database: 'demo_slot_2',
        username: '2abcde123456789.m3d_s2',
        password: 'p2',
      },
      {
        slotId: 'slot-3',
        database: 'demo_slot_3',
        username: `2abcde123456789.${'a'.repeat(16)}`,
        password: 'p3',
      },
    ];
    const loaded = loadDemoSandboxConfigFromEnv({
      ...baseEnv(),
      DB_USER: '2abcde123456789.app',
      DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(prefixedSlots),
    });
    expect(loaded).toMatchObject({
      enabled: true,
      connections: { controlPlaneUsername: '2abcde123456789.app', slots: prefixedSlots },
    });
  });

  it.each([
    ['invalid DEMO_SANDBOX_ENABLED', { DEMO_SANDBOX_ENABLED: 'yes' }, /DEMO_SANDBOX_ENABLED/],
    [
      'invalid DEMO_SANDBOX_RECOVER_ON_BOOT',
      { DEMO_SANDBOX_RECOVER_ON_BOOT: '1' },
      /DEMO_SANDBOX_RECOVER_ON_BOOT/,
    ],
    [
      'missing DEMO_SANDBOX_JWT_SECRET',
      { DEMO_SANDBOX_JWT_SECRET: '' },
      /DEMO_SANDBOX_JWT_SECRET is required/,
    ],
    [
      'short DEMO_SANDBOX_JWT_SECRET',
      { DEMO_SANDBOX_JWT_SECRET: 'a'.repeat(31) },
      /at least 32 characters/,
    ],
    [
      'space-padded DEMO_SANDBOX_JWT_SECRET trimming to 31 chars',
      { DEMO_SANDBOX_JWT_SECRET: `  ${'a'.repeat(31)}  ` },
      /at least 32 characters/,
    ],
    [
      'colliding DEMO_SANDBOX_JWT_SECRET',
      { DEMO_SANDBOX_JWT_SECRET: 'prod-secret-at-least-32-chars-long-0001' },
      /must differ from JWT_SECRET/,
    ],
    [
      'padded colliding DEMO_SANDBOX_JWT_SECRET',
      { DEMO_SANDBOX_JWT_SECRET: '  prod-secret-at-least-32-chars-long-0001  ' },
      /must differ from JWT_SECRET/,
    ],
    ['missing CA cert in production', { DB_CA_CERT: '' }, /DB_CA_CERT/],
    ['blank DEMO_SANDBOX_DB_CA_CERT', { DEMO_SANDBOX_DB_CA_CERT: '   ' }, /DB_CA_CERT/],
    [
      'slot username colliding with DB_USER',
      { DB_USER: 'demo_u2' },
      /Invalid demo sandbox connection configuration/,
    ],
    [
      'prefixed slot username colliding case-insensitively with prefixed DB_USER',
      {
        DB_USER: '2abcde123456789.app',
        DEMO_SANDBOX_SLOTS_JSON: JSON.stringify([
          { ...validSlots[0], username: '2abcde123456789.m3d_s1' },
          { ...validSlots[1], username: '2ABCDE123456789.APP' },
          { ...validSlots[2], username: '2abcde123456789.m3d_s3' },
        ]),
      },
      /Invalid demo sandbox connection configuration/,
    ],
    [
      'prefixed root slot username',
      {
        DEMO_SANDBOX_SLOTS_JSON: JSON.stringify([
          { ...validSlots[0], username: '2abcde123456789.ROOT' },
          validSlots[1],
          validSlots[2],
        ]),
      },
      /Invalid demo sandbox connection configuration/,
    ],
    [
      'malformed dotted slot usernames and >32 chars',
      {
        DEMO_SANDBOX_SLOTS_JSON: JSON.stringify([
          { ...validSlots[0], username: 'a.b.c' },
          validSlots[1],
          validSlots[2],
        ]),
      },
      /Invalid demo sandbox connection configuration/,
    ],
    [
      'leading dot slot username',
      {
        DEMO_SANDBOX_SLOTS_JSON: JSON.stringify([
          { ...validSlots[0], username: '.m3d_s1' },
          validSlots[1],
          validSlots[2],
        ]),
      },
      /Invalid demo sandbox connection configuration/,
    ],
    [
      'trailing dot slot username',
      {
        DEMO_SANDBOX_SLOTS_JSON: JSON.stringify([
          { ...validSlots[0], username: '2abcde123456789.' },
          validSlots[1],
          validSlots[2],
        ]),
      },
      /Invalid demo sandbox connection configuration/,
    ],
    [
      'prefixed slot username exceeding 32 chars',
      {
        DEMO_SANDBOX_SLOTS_JSON: JSON.stringify([
          { ...validSlots[0], username: `2abcde123456789.${'a'.repeat(17)}` },
          validSlots[1],
          validSlots[2],
        ]),
      },
      /Invalid demo sandbox connection configuration/,
    ],
    [
      'dotted slot database name',
      {
        DEMO_SANDBOX_SLOTS_JSON: JSON.stringify([
          { ...validSlots[0], database: 'bad.db_name' },
          validSlots[1],
          validSlots[2],
        ]),
      },
      /Invalid demo sandbox connection configuration/,
    ],
    ['invalid port', { DB_PORT: '4000abc' }, /Invalid demo sandbox connection configuration/],
    ['malformed slots JSON', { DEMO_SANDBOX_SLOTS_JSON: '{bad' }, /valid JSON/],
    [
      'fewer than 3 slots',
      { DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(validSlots.slice(0, 2)) },
      /between 3 and 5 slots/,
    ],
    [
      'more than 5 slots',
      {
        DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(
          Array.from({ length: 6 }, (_, i) => ({
            slotId: `slot-${i + 1}`,
            database: `demo_slot_${i + 1}`,
            username: `demo_u${i + 1}`,
            password: `p${i + 1}`,
          })),
        ),
      },
      /between 3 and 5 slots/,
    ],
    [
      'slot colliding with control-plane DB',
      {
        DEMO_SANDBOX_SLOTS_JSON: JSON.stringify([
          validSlots[0],
          validSlots[1],
          { ...validSlots[2], database: 'mundo_3d_control' },
        ]),
      },
      /Invalid demo sandbox connection configuration/,
    ],
  ])('fails closed on %s', (_label, override, pattern) => {
    expect(() => loadDemoSandboxConfigFromEnv({ ...baseEnv(), ...override })).toThrow(pattern);
  });
});
