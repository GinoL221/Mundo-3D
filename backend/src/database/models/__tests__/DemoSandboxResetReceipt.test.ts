import { Sequelize } from 'sequelize';
import { createDemoSandboxResetReceiptModel } from '../DemoSandboxResetReceipt';
import { SequelizeSandboxReceiptWriter } from '../../../infrastructure/persistence/SequelizeSandboxReceiptWriter';

describe('DemoSandboxResetReceipt model', () => {
  it('declares an attempt primary key on the supplied connection without connecting', () => {
    const connection = new Sequelize('sandbox', 'dummy', 'dummy', {
      dialect: 'mysql',
      logging: false,
    });
    const authenticate = jest.spyOn(connection, 'authenticate');
    const query = jest.spyOn(connection, 'query');
    const model = createDemoSandboxResetReceiptModel(connection);
    expect(model.sequelize).toBe(connection);
    expect(model.getTableName()).toBe('DemoSandboxResetReceipt');
    expect(model.rawAttributes.attemptId.primaryKey).toBe(true);
    expect(model.rawAttributes.slotId.allowNull).toBe(false);
    expect(model.rawAttributes.generation.allowNull).toBe(false);
    expect(model.rawAttributes.seedVersion.allowNull).toBe(false);
    expect(model.rawAttributes.consumed.defaultValue).toBe(false);
    expect(() => new SequelizeSandboxReceiptWriter(connection, 'slot-a', model)).not.toThrow();
    expect(authenticate).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
