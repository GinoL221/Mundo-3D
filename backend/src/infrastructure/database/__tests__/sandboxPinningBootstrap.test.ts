import { bootstrapPinningDatabase } from './support/sandboxPinningBootstrap';

const database = 'm3d_sandbox_verify_pinning';
const uuid = '11111111-1111-1111-1111-111111111111';
const uuidQuery = 'SELECT @@server_uuid AS serverUuid';
const schemaQuery = `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${database}'`;

test('rejects a foreign server before schema inspection or mutation', async () => {
  const query = jest.fn().mockResolvedValue([[{ serverUuid: 'foreign' }], {}]);
  await expect(bootstrapPinningDatabase({ query }, database, uuid)).rejects.toThrow(
    'Disposable sandbox server identity mismatch',
  );
  expect(query.mock.calls).toEqual([[uuidQuery]]);
});

test('refuses an existing schema without deleting or changing it', async () => {
  const query = jest.fn()
    .mockResolvedValueOnce([[{ serverUuid: uuid }], {}])
    .mockResolvedValueOnce([[{ SCHEMA_NAME: database }], {}]);
  await expect(bootstrapPinningDatabase({ query }, database, uuid)).rejects.toThrow(
    'Disposable sandbox schema already exists; preserve it for inspection',
  );
  expect(query.mock.calls).toEqual([[uuidQuery], [schemaQuery]]);
});

test('creates only a fresh schema on the verified server, without IF NOT EXISTS', async () => {
  const query = jest.fn()
    .mockResolvedValueOnce([[{ serverUuid: uuid }], {}])
    .mockResolvedValueOnce([[], {}])
    .mockResolvedValueOnce([[], {}]);
  await expect(bootstrapPinningDatabase({ query }, database, uuid)).resolves.toBeUndefined();
  expect(query.mock.calls).toEqual([[uuidQuery], [schemaQuery], [`CREATE DATABASE \`${database}\``]]);
});
