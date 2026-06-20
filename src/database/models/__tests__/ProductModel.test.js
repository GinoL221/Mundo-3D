const ProductDefine = require('../Product');
const { DataTypes } = require('sequelize');

describe('Product Model Definition', () => {
  it('defines Product with camelCase foreign keys, snake_case fields, and legacy getters', () => {
    const defineMock = jest.fn((name, attributes, options) => {
      return { name, attributes, options };
    });
    const mockSequelize = {
      define: defineMock,
    };

    ProductDefine(mockSequelize);

    expect(defineMock).toHaveBeenCalledWith(
      'Product',
      expect.objectContaining({
        idCategory: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'id_category',
        }),
        idFranchise: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'id_franchise',
        }),
      }),
      expect.objectContaining({
        tableName: 'Product',
        timestamps: false,
        getterMethods: expect.objectContaining({
          IDCategory: expect.any(Function),
          IDFranchise: expect.any(Function),
        }),
      })
    );
  });
});
