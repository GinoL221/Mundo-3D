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

  it('loads and associates Product with Category and Franchise', () => {
    const db = initializeModels();
    expect(db.Product).toBeDefined();
    expect(db.Category).toBeDefined();
    expect(db.Franchise).toBeDefined();
    expect(db.Product.belongsTo).toHaveBeenCalledWith(
      db.Category,
      expect.objectContaining({
        foreignKey: 'idCategory',
        as: 'Category',
      })
    );
    expect(db.Category.hasMany).toHaveBeenCalledWith(
      db.Product,
      expect.objectContaining({
        foreignKey: 'idCategory',
        as: 'Products',
      })
    );
    expect(db.Product.belongsTo).toHaveBeenCalledWith(
      db.Franchise,
      expect.objectContaining({
        foreignKey: 'idFranchise',
        as: 'Franchise',
      })
    );
    expect(db.Franchise.hasMany).toHaveBeenCalledWith(
      db.Product,
      expect.objectContaining({
        foreignKey: 'idFranchise',
        as: 'Products',
      })
    );
  });

  it('loads and associates ShoppingCart with User and Product', () => {
    const db = initializeModels();
    expect(db.ShoppingCart).toBeDefined();
    expect(db.User.hasMany).toHaveBeenCalledWith(
      db.ShoppingCart,
      expect.objectContaining({
        foreignKey: 'idUser',
      })
    );
    expect(db.ShoppingCart.belongsTo).toHaveBeenCalledWith(
      db.User,
      expect.objectContaining({
        foreignKey: 'idUser',
      })
    );
    expect(db.Product.hasMany).toHaveBeenCalledWith(
      db.ShoppingCart,
      expect.objectContaining({
        foreignKey: 'idProduct',
        as: 'ShoppingCarts',
      })
    );
    expect(db.ShoppingCart.belongsTo).toHaveBeenCalledWith(
      db.Product,
      expect.objectContaining({
        foreignKey: 'idProduct',
        as: 'product',
      })
    );
  });
});
