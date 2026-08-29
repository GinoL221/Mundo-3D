'use strict';

// Unit test for `ensureDatabaseExists()`'s guard against an unsupported
// `NODE_ENV` value. `config.js` only defines `development`/`test`/`production`
// keys, so any other env previously caused a generic
// `TypeError: Cannot read properties of undefined` instead of a clear,
// actionable configuration error.
jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn(),
}));

const mysql = require('mysql2/promise');
const { ensureDatabaseExists } = require('../ensureDatabase');

describe('ensureDatabaseExists', () => {
  beforeEach(() => {
    mysql.createConnection.mockReset();
  });

  it('throws a clear configuration error for an unsupported NODE_ENV', async () => {
    await expect(ensureDatabaseExists('staging')).rejects.toThrow(
      "Unsupported NODE_ENV: 'staging' — expected one of: development, test, production"
    );
    expect(mysql.createConnection).not.toHaveBeenCalled();
  });

  it('proceeds to create a connection for a supported NODE_ENV', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const end = jest.fn().mockResolvedValue(undefined);
    mysql.createConnection.mockResolvedValue({ query, end });

    await expect(ensureDatabaseExists('test')).resolves.toBeUndefined();
    expect(mysql.createConnection).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('CREATE DATABASE IF NOT EXISTS'));
  });

  // spec: managed-database-connectivity — "No Database Creation in Production".
  // The managed DB pre-exists and the scoped user lacks CREATE DATABASE, so the
  // production path must be a total no-op: no raw mysql2 connection, no
  // `CREATE DATABASE`, while still resolving `undefined` to keep the boot
  // chain's `.then()` shape intact.
  it('is a no-op in production — never opens a raw connection', async () => {
    await expect(ensureDatabaseExists('production')).resolves.toBeUndefined();
    expect(mysql.createConnection).not.toHaveBeenCalled();
  });

  it('still validates an unsupported NODE_ENV before the production short-circuit', async () => {
    await expect(ensureDatabaseExists('staging')).rejects.toThrow(
      "Unsupported NODE_ENV: 'staging' — expected one of: development, test, production"
    );
    expect(mysql.createConnection).not.toHaveBeenCalled();
  });
});
