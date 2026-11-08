'use strict';

// Behaviour under test (spec: managed-database-connectivity —
// "Production Database Port and TLS", plus E2E isolated runner):
//   * the `production` block must expose a numeric `port` sourced from
//     `DB_PORT`, and MUST NOT expose `port` at all when `DB_PORT` is unset
//     (a `Number(undefined)` NaN must never reach the driver);
//   * the `production` block must enforce verified TLS via
//     `dialectOptions.ssl.ca` = `DB_CA_CERT` and `rejectUnauthorized: true`;
//   * `rejectUnauthorized: false` must not appear anywhere;
//   * the `development` block must be byte-unchanged — no `port`, no `dialectOptions`;
//   * the `test` block optionally consumes numeric `port` from `DB_PORT` for isolated E2E runs.

const ORIGINAL_ENV = process.env;

function loadConfig(overrides = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return require('../config');
}

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.resetModules();
});

describe('database config — production port', () => {
  it('sets production.port from DB_PORT parsed as a Number', () => {
    const config = loadConfig({ DB_PORT: '24063', DB_CA_CERT: 'PEM' });
    expect(config.production.port).toBe(24063);
  });

  it('omits production.port entirely when DB_PORT is unset (never NaN)', () => {
    const config = loadConfig({ DB_PORT: undefined, DB_CA_CERT: 'PEM' });
    expect(Object.prototype.hasOwnProperty.call(config.production, 'port')).toBe(false);
    expect(config.production.port).toBeUndefined();
    expect(Number.isNaN(config.production.port)).toBe(false);
  });
});

describe('database config — production TLS', () => {
  it('sets production.dialectOptions.ssl.ca from DB_CA_CERT and verifies the certificate', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nMIIBfoo\n-----END CERTIFICATE-----';
    const config = loadConfig({ DB_PORT: '24063', DB_CA_CERT: pem });
    expect(config.production.dialectOptions.ssl.ca).toBe(pem);
    expect(config.production.dialectOptions.ssl.rejectUnauthorized).toBe(true);
  });

  it('never uses rejectUnauthorized: false anywhere in the exported config', () => {
    const config = loadConfig({ DB_PORT: '24063', DB_CA_CERT: 'PEM' });
    const serialised = JSON.stringify(config);
    expect(serialised).not.toMatch(/"rejectUnauthorized"\s*:\s*false/);
  });

  it('omits dialectOptions entirely when DB_CA_CERT is unset (never a bare TLS attempt with no CA)', () => {
    const config = loadConfig({ DB_PORT: '24063', DB_CA_CERT: undefined });
    expect(Object.prototype.hasOwnProperty.call(config.production, 'dialectOptions')).toBe(false);
  });
});

describe('database config — dev/test blocks unchanged', () => {
  it('development block has no port and no dialectOptions', () => {
    const config = loadConfig({ DB_PORT: '24063', DB_CA_CERT: 'PEM' });
    expect(Object.prototype.hasOwnProperty.call(config.development, 'port')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(config.development, 'dialectOptions')).toBe(false);
  });

  it('test block consumes DB_PORT when present and has no dialectOptions', () => {
    const configWithPort = loadConfig({ DB_PORT: '24063', DB_CA_CERT: 'PEM' });
    expect(configWithPort.test.port).toBe(24063);
    expect(Object.prototype.hasOwnProperty.call(configWithPort.test, 'dialectOptions')).toBe(false);

    const configWithoutPort = loadConfig({ DB_PORT: undefined, DB_CA_CERT: 'PEM' });
    expect(Object.prototype.hasOwnProperty.call(configWithoutPort.test, 'port')).toBe(false);
  });

  it('development block keeps exactly its five original keys', () => {
    const config = loadConfig({ DB_PORT: '24063', DB_CA_CERT: 'PEM' });
    expect(Object.keys(config.development).sort()).toEqual([
      'database',
      'dialect',
      'host',
      'password',
      'username',
    ]);
    expect(config.development.dialect).toBe('mysql');
  });

  it('test block keeps its expected keys depending on DB_PORT presence', () => {
    const configWithPort = loadConfig({ DB_PORT: '24063', DB_CA_CERT: 'PEM' });
    expect(Object.keys(configWithPort.test).sort()).toEqual([
      'database',
      'dialect',
      'host',
      'password',
      'port',
      'username',
    ]);
    expect(configWithPort.test.dialect).toBe('mysql');
    expect(configWithPort.test.database).toBe('mundo_3d_test');

    const configWithoutPort = loadConfig({ DB_PORT: undefined });
    expect(Object.keys(configWithoutPort.test).sort()).toEqual([
      'database',
      'dialect',
      'host',
      'password',
      'username',
    ]);
  });
});
