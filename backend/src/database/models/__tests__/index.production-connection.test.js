'use strict';

// spec: managed-database-connectivity — "Production Database Port and TLS".
// `models/index.js` forwards the whole `config[env]` object as Sequelize's 4th
// (options) argument, and the Umzug migrator + boot schema gate reuse that same
// `db.sequelize`. This test proves the production `port` and
// `dialectOptions.ssl` reach that options object with no extra wiring.

const ORIGINAL_ENV = process.env;

jest.mock('sequelize', () => {
  const mSequelize = jest.fn(() => ({
    define: jest.fn((name) => ({
      name,
      hasMany: jest.fn(),
      belongsTo: jest.fn(),
    })),
  }));
  mSequelize.DataTypes = {
    INTEGER: 'INTEGER',
    STRING: jest.fn().mockReturnValue('STRING'),
    CHAR: jest.fn().mockReturnValue('CHAR'),
    DATE: 'DATE',
    DECIMAL: jest.fn().mockReturnValue('DECIMAL'),
    TEXT: 'TEXT',
  };
  return mSequelize;
});

function loadWithEnv(overrides) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  const Sequelize = require('sequelize');
  const { initializeModels } = require('../index');
  return { Sequelize, initializeModels };
}

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.resetModules();
});

describe('models/index.js — production connection options threading', () => {
  it('passes production port and verified-TLS dialectOptions to the Sequelize constructor', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nMIIBprod\n-----END CERTIFICATE-----';
    const { Sequelize, initializeModels } = loadWithEnv({
      NODE_ENV: 'production',
      DB_PORT: '24063',
      DB_CA_CERT: pem,
    });

    initializeModels();

    expect(Sequelize).toHaveBeenCalledTimes(1);
    const options = Sequelize.mock.calls[0][3];
    expect(options.port).toBe(24063);
    expect(options.dialectOptions.ssl.ca).toBe(pem);
    expect(options.dialectOptions.ssl.rejectUnauthorized).toBe(true);
  });

  it('threads no port and no dialectOptions in the development environment', () => {
    const { Sequelize, initializeModels } = loadWithEnv({
      NODE_ENV: 'development',
      DB_PORT: '24063',
      DB_CA_CERT: 'PEM',
    });

    initializeModels();

    const options = Sequelize.mock.calls[0][3];
    expect(Object.prototype.hasOwnProperty.call(options, 'port')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(options, 'dialectOptions')).toBe(false);
  });
});
