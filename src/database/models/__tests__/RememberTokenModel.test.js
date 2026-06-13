const RememberTokenDefine = require('../RememberToken');
const { DataTypes } = require('sequelize');

describe('RememberToken Model Definition', () => {
  it('defines the model with expected schema', () => {
    const defineMock = jest.fn((name, attributes, options) => {
      return { name, attributes, options };
    });
    const mockSequelize = {
      define: defineMock,
    };

    const RememberToken = RememberTokenDefine(mockSequelize);

    expect(defineMock).toHaveBeenCalledWith(
      'RememberToken',
      expect.objectContaining({
        id: expect.objectContaining({
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        }),
        IDUser: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: false,
        }),
        TokenHash: expect.objectContaining({
          type: DataTypes.STRING(64),
          allowNull: false,
          unique: true,
        }),
        ExpiresAt: expect.objectContaining({
          type: DataTypes.DATE,
          allowNull: false,
        }),
      }),
      expect.objectContaining({
        tableName: 'RememberToken',
        timestamps: false,
      })
    );
  });
});
