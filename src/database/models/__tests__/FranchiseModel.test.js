const FranchiseDefine = require('../Franchise');
const { DataTypes } = require('sequelize');

describe('Franchise Model Definition', () => {
  it('defines Franchise with camelCase attributes, snake_case fields, and legacy getters', () => {
    const defineMock = jest.fn((name, attributes, options) => {
      return { name, attributes, options };
    });
    const mockSequelize = {
      define: defineMock,
    };

    FranchiseDefine(mockSequelize);

    expect(defineMock).toHaveBeenCalledWith(
      'Franchise',
      expect.objectContaining({
        idFranchise: expect.objectContaining({
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
          field: 'id_franchise',
        }),
        nameFranchise: expect.objectContaining({
          type: expect.anything(),
          allowNull: false,
          unique: true,
          field: 'name_franchise',
        }),
      }),
      expect.objectContaining({
        tableName: 'Franchise',
        timestamps: false,
        getterMethods: expect.objectContaining({
          IDFranchise: expect.any(Function),
          NameFranchise: expect.any(Function),
        }),
      })
    );
  });
});
