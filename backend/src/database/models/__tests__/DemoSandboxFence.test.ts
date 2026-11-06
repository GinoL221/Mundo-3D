import { Sequelize } from 'sequelize';
import { createDemoSandboxFenceModel } from '../DemoSandboxFence';
import { SequelizeSandboxFence } from '../../../infrastructure/persistence/SequelizeSandboxFence';

describe('DemoSandboxFence model', () => {
  it('defines a slot-bound fence on the supplied connection without connecting', () => {
    const connection = new Sequelize('sandbox', 'dummy', 'dummy', {
      dialect: 'mysql',
      logging: false,
    });
    const authenticate = jest.spyOn(connection, 'authenticate');
    const query = jest.spyOn(connection, 'query');
    const model = createDemoSandboxFenceModel(connection);
    expect(model.sequelize).toBe(connection);
    expect(model.getTableName()).toBe('DemoSandboxFence');
    expect(model.rawAttributes.slotId.field).toBe('slot_id');
    expect(model.rawAttributes.slotId.primaryKey).toBe(true);
    expect(model.rawAttributes.leaseId.field).toBe('lease_id');
    expect(model.rawAttributes.leaseId.allowNull).toBe(true);
    expect(model.rawAttributes.resetAttemptId.field).toBe('reset_attempt_id');
    expect(model.rawAttributes.resetAttemptId.allowNull).toBe(true);
    expect(model.rawAttributes.generation.allowNull).toBe(false);
    expect(model.rawAttributes.state.allowNull).toBe(false);
    expect(() => new SequelizeSandboxFence(connection, 'slot-1', model)).not.toThrow();
    expect(authenticate).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();

    // Cache verification
    expect(createDemoSandboxFenceModel(connection)).toBe(model);

    // Different connection gets its own model instance
    const foreignConnection = new Sequelize('sandbox_other', 'dummy', 'dummy', {
      dialect: 'mysql',
      logging: false,
    });
    const foreignModel = createDemoSandboxFenceModel(foreignConnection);
    expect(foreignModel).not.toBe(model);
    expect(foreignModel.sequelize).toBe(foreignConnection);
  });
});
