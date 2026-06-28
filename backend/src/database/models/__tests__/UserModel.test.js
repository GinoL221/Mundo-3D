const UserDefine = require('../User');
const { DataTypes } = require('sequelize');

describe('User Model Definition', () => {
  it('defines the model with expected camelCase properties and snake_case fields', () => {
    const defineMock = jest.fn((name, attributes, options) => {
      return { name, attributes, options };
    });
    const mockSequelize = {
      define: defineMock,
    };

    UserDefine(mockSequelize);

    expect(defineMock).toHaveBeenCalledWith(
      'User',
      expect.objectContaining({
        idUser: expect.objectContaining({
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_user',
        }),
        firstName: expect.objectContaining({
          type: DataTypes.STRING,
          allowNull: false,
          field: 'first_name',
        }),
        lastName: expect.objectContaining({
          type: DataTypes.STRING,
          allowNull: false,
          field: 'last_name',
        }),
        email: expect.objectContaining({
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          field: 'email',
        }),
        image: expect.objectContaining({
          type: DataTypes.STRING,
          field: 'image',
        }),
        passwordUser: expect.objectContaining({
          type: DataTypes.STRING,
          allowNull: false,
          field: 'password_user',
        }),
        idRole: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 2,
          field: 'id_role',
        }),
        category: expect.objectContaining({
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'User',
          field: 'category',
        }),
      }),
      expect.objectContaining({
        tableName: 'User',
        timestamps: false,
      })
    );
  });
});
