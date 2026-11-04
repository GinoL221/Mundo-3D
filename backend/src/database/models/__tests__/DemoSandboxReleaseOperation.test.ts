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
