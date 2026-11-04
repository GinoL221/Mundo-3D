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
    expect(model.rawAttributes.releaseId.primaryKey).toBe(true);
    expect(model.rawAttributes.slotId.allowNull).toBe(false);
    expect(model.rawAttributes.generation.allowNull).toBe(false);
    expect(model.rawAttributes.attemptId.allowNull).toBe(false);
    expect(model.rawAttributes.seedVersion.allowNull).toBe(false);
    expect(model.rawAttributes.leaseId.allowNull).toBe(false);
    expect(model.rawAttributes.releaseId.field).toBe('release_id');
    expect(model.rawAttributes.slotId.field).toBe('slot_id');
    expect(model.rawAttributes.attemptId.field).toBe('attempt_id');
    expect(model.rawAttributes.seedVersion.field).toBe('seed_version');
    expect(model.rawAttributes.leaseId.field).toBe('lease_id');
    expect(String(model.rawAttributes.releaseId.type)).toBe('CHAR(36) BINARY');
    expect(String(model.rawAttributes.slotId.type)).toBe('VARCHAR(64)');
    expect(String(model.rawAttributes.generation.type)).toBe('INTEGER UNSIGNED');
    expect(String(model.rawAttributes.seedVersion.type)).toBe('VARCHAR(128)');
    expect(String(model.rawAttributes.attemptId.type)).toBe('CHAR(36) BINARY');
    expect(String(model.rawAttributes.leaseId.type)).toBe('CHAR(36) BINARY');
    expect(authenticate).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
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
