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
    const attributes = model.getAttributes();
    expect(attributes.slotId.field).toBe('slot_id');
    expect(attributes.slotId.primaryKey).toBe(true);
    expect(attributes.leaseId.field).toBe('lease_id');
    expect(attributes.leaseId.allowNull).toBe(true);
    expect(attributes.resetAttemptId.field).toBe('reset_attempt_id');
    expect(attributes.resetAttemptId.allowNull).toBe(true);
    expect(attributes.generation.allowNull).toBe(false);
    expect(attributes.state.allowNull).toBe(false);
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
