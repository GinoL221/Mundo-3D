const { initializeModels } = require('../index');
const Sequelize = require('sequelize');

jest.mock('sequelize', () => {
  const mSequelize = jest.fn(() => ({
    define: jest.fn((name) => {
      const model = {
        name,
        hasMany: jest.fn(),
        belongsTo: jest.fn(),
      };
      return model;
    }),
  }));
  mSequelize.DataTypes = {
    INTEGER: 'INTEGER',
    STRING: jest.fn().mockReturnValue('STRING'),
    DATE: 'DATE',
    DECIMAL: jest.fn().mockReturnValue('DECIMAL'),
    TEXT: 'TEXT',
  };
  return mSequelize;
});

describe('Database Model Initialization & Association', () => {
  it('loads and associates RememberToken with User', () => {
    const db = initializeModels();
    expect(db.RememberToken).toBeDefined();
    expect(db.User.hasMany).toHaveBeenCalledWith(
      db.RememberToken,
      expect.objectContaining({
        foreignKey: 'idUser',
      })
    );
    expect(db.RememberToken.belongsTo).toHaveBeenCalledWith(
      db.User,
      expect.objectContaining({
        foreignKey: 'idUser',
      })
    );
  });
});
