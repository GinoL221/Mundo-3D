const CategoryDefine = require('../Category');
const { DataTypes } = require('sequelize');

describe('Category Model Definition', () => {
  it('defines Category with camelCase attributes, snake_case fields, and legacy getters', () => {
    const defineMock = jest.fn((name, attributes, options) => {
      return { name, attributes, options };
    });
    const mockSequelize = {
      define: defineMock,
    };

    CategoryDefine(mockSequelize);

    expect(defineMock).toHaveBeenCalledWith(
      'Category',
      expect.objectContaining({
        idCategory: expect.objectContaining({
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_category',
        }),
        nameCategory: expect.objectContaining({
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          field: 'name_category',
        }),
      }),
      expect.objectContaining({
        tableName: 'Category',
        timestamps: false,
        getterMethods: expect.objectContaining({
          IDCategory: expect.any(Function),
          NameCategory: expect.any(Function),
        }),
      })
    );
  });
});
