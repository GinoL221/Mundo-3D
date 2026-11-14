import { Sequelize } from 'sequelize';
import { createDemoSandboxReleaseOperationModel } from '../DemoSandboxReleaseOperation';

describe('DemoSandboxReleaseOperation model', () => {
  it('declares a release primary key on the supplied connection without connecting', () => {
    const connection = new Sequelize('sandbox', 'dummy', 'dummy', {
      dialect: 'mysql',
      logging: false,
    });
    const authenticate = jest.spyOn(connection, 'authenticate');
    const query = jest.spyOn(connection, 'query');
    const model = createDemoSandboxReleaseOperationModel(connection);

    expect(model.sequelize).toBe(connection);
    expect(model.getTableName()).toBe('DemoSandboxReleaseOperation');
    const attributes = model.getAttributes();
    expect(attributes.releaseId.primaryKey).toBe(true);
    expect(attributes.slotId.allowNull).toBe(false);
    expect(attributes.generation.allowNull).toBe(false);
    expect(attributes.attemptId.allowNull).toBe(false);
    expect(attributes.seedVersion.allowNull).toBe(false);
    expect(attributes.leaseId.allowNull).toBe(false);
    expect(attributes.releaseId.field).toBe('release_id');
    expect(attributes.slotId.field).toBe('slot_id');
    expect(attributes.attemptId.field).toBe('attempt_id');
    expect(attributes.seedVersion.field).toBe('seed_version');
    expect(attributes.leaseId.field).toBe('lease_id');
    expect(String(attributes.releaseId.type)).toBe('CHAR(36) BINARY');
    expect(String(attributes.slotId.type)).toBe('VARCHAR(64)');
    expect(String(attributes.generation.type)).toBe('INTEGER UNSIGNED');
    expect(String(attributes.seedVersion.type)).toBe('VARCHAR(128)');
    expect(String(attributes.attemptId.type)).toBe('CHAR(36) BINARY');
    expect(String(attributes.leaseId.type)).toBe('CHAR(36) BINARY');
    expect(authenticate).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('declares the same uniqueness rule as the migration', () => {
    const connection = new Sequelize('sandbox', 'dummy', 'dummy', {
      dialect: 'mysql',
      logging: false,
    });
    const model = createDemoSandboxReleaseOperationModel(connection);
    const indexes = model.options.indexes ?? [];

    expect(indexes).toHaveLength(1);
    expect(indexes[0]).toMatchObject({
      name: 'uq_release_attempt',
      unique: true,
      fields: ['slot_id', 'generation', 'attempt_id'],
    });
  });

  it('declares the uniqueness as an index, which the dialect reports by name', () => {
    const connection = new Sequelize('sandbox', 'dummy', 'dummy', {
      dialect: 'mysql',
      logging: false,
    });
    const model = createDemoSandboxReleaseOperationModel(connection);

    // Sequelize only fills `uniqueKeys` from attribute-level `unique`, so a
    // composite index stays there and the driver reports its name instead of
    // the individual columns. The field exists at runtime but is not declared
    // on ModelStatic in the public types.
    // SAFETY: read-only inspection of a Sequelize 6 runtime field in a test.
    const uniqueKeys = (model as unknown as { uniqueKeys: Record<string, unknown> }).uniqueKeys;
    expect(Object.keys(uniqueKeys)).toHaveLength(0);
    expect(model.options.indexes?.[0]).toMatchObject({ name: 'uq_release_attempt', unique: true });
  });

  it('reuses the definition per connection and isolates distinct connections', () => {
    const first = new Sequelize('sandbox', 'dummy', 'dummy', { dialect: 'mysql', logging: false });
    const second = new Sequelize('sandbox', 'dummy', 'dummy', { dialect: 'mysql', logging: false });

    expect(createDemoSandboxReleaseOperationModel(first)).toBe(
      createDemoSandboxReleaseOperationModel(first),
    );
    expect(createDemoSandboxReleaseOperationModel(first)).not.toBe(
      createDemoSandboxReleaseOperationModel(second),
    );
  });
});
