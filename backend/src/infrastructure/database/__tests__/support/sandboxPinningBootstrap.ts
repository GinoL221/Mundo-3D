interface BootstrapConnection {
  query(sql: string): Promise<unknown>;
}

function rows(result: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(result) || !Array.isArray(result[0])) {
    throw new Error('Disposable sandbox inspection returned invalid rows');
  }
  return result[0] as Array<Record<string, unknown>>;
}

/** Refuse foreign servers and existing schemas before any DDL; never delete stored data. */
export async function bootstrapPinningDatabase(
  connection: BootstrapConnection,
  database: string,
  expectedUuid: string,
): Promise<void> {
  if (!/^[a-zA-Z0-9_]+$/.test(database) || !expectedUuid) {
    throw new Error('Explicit disposable sandbox identity required');
  }
  const server = rows(await connection.query('SELECT @@server_uuid AS serverUuid'));
  if (server.length !== 1 || server[0]?.serverUuid !== expectedUuid) {
    throw new Error('Disposable sandbox server identity mismatch');
  }
  const schemas = rows(await connection.query(
    `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${database}'`,
  ));
  if (schemas.length !== 0) {
    throw new Error('Disposable sandbox schema already exists; preserve it for inspection');
  }
  // No IF NOT EXISTS: a competing creator must fail rather than sharing its data.
  await connection.query(`CREATE DATABASE \`${database}\``);
}
