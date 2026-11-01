jest.mock('../../config/config', () => {
  throw new Error('Explicit model registration must not load environment configuration');
});
jest.mock('../db', () => {
  throw new Error('Explicit model registration must not load the default database');
});
jest.mock('sequelize', () => {
  const actual = jest.requireActual('sequelize');
  const constructor = jest.fn(() => {
    throw new Error('Explicit model registration must not construct a connection');
  });
  constructor.DataTypes = actual.DataTypes;
  return constructor;
});

const { initializeModelsForConnection } = require('../registerModels');

function connection() {
  const sequelize = { authenticate: jest.fn(), sync: jest.fn(), query: jest.fn() };
  sequelize.define = jest.fn((name) => ({
    name,
    sequelize,
    hasMany: jest.fn(),
    belongsTo: jest.fn(),
  }));
  return sequelize;
}

test('registers independent complete model graphs and associations on explicit connections only', () => {
  const a = connection();
  const b = connection();
  const graphA = initializeModelsForConnection(a);
  const graphB = initializeModelsForConnection(b);
  const names = [
    'User',
    'Product',
    'ShoppingCart',
    'Category',
    'Franchise',
    'RememberToken',
    'EmailConfirmationToken',
    'Order',
    'OrderItem',
    'CustomCommissionRequest',
  ];
  for (const name of names) {
    expect(graphA[name]).not.toBe(graphB[name]);
    expect(graphA[name].sequelize).toBe(a);
    expect(graphB[name].sequelize).toBe(b);
    for (const method of ['hasMany', 'belongsTo']) {
      for (const [target] of graphA[name][method].mock.calls) expect(target.sequelize).toBe(a);
      for (const [target] of graphB[name][method].mock.calls) expect(target.sequelize).toBe(b);
    }
  }
  for (const [graph, sequelize] of [
    [graphA, a],
    [graphB, b],
  ]) {
    expect(graph.sequelize).toBe(sequelize);
    expect(sequelize.define).toHaveBeenCalledTimes(names.length);
    expect(graph.Product.belongsTo).toHaveBeenCalledWith(
      graph.Category,
      expect.objectContaining({ as: 'Category' }),
    );
    expect(graph.Product.belongsTo).toHaveBeenCalledWith(
      graph.Franchise,
      expect.objectContaining({ as: 'Franchise' }),
    );
    expect(graph.Order.hasMany).toHaveBeenCalledWith(
      graph.OrderItem,
      expect.objectContaining({ as: 'items' }),
    );
    expect(graph.CustomCommissionRequest.belongsTo).toHaveBeenCalledWith(
      graph.Product,
      expect.objectContaining({ as: 'Product' }),
    );
    expect(sequelize.authenticate).not.toHaveBeenCalled();
    expect(sequelize.sync).not.toHaveBeenCalled();
    expect(sequelize.query).not.toHaveBeenCalled();
  }
});
