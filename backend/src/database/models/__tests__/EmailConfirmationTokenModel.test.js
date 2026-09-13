const EmailConfirmationTokenDefine = require('../EmailConfirmationToken');
const { DataTypes } = require('sequelize');

describe('EmailConfirmationToken Model Definition', () => {
  it('defines digest-only confirmation-token persistence fields', () => {
    const defineMock = jest.fn((name, attributes, options) => ({ name, attributes, options }));
    const mockSequelize = { define: defineMock };

    EmailConfirmationTokenDefine(mockSequelize);

    expect(defineMock).toHaveBeenCalledWith(
      'EmailConfirmationToken',
      expect.objectContaining({
        idEmailConfirmationToken: expect.objectContaining({
          type: DataTypes.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_email_confirmation_token',
        }),
        idUser: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'id_user',
        }),
        tokenHash: expect.objectContaining({
          type: DataTypes.CHAR(64),
          allowNull: false,
          unique: true,
          field: 'token_hash',
        }),
        expiresAt: expect.objectContaining({
          type: DataTypes.DATE,
          allowNull: false,
          field: 'expires_at',
        }),
        consumedAt: expect.objectContaining({
          type: DataTypes.DATE,
          allowNull: true,
          field: 'consumed_at',
        }),
        invalidatedAt: expect.objectContaining({
          type: DataTypes.DATE,
          allowNull: true,
          field: 'invalidated_at',
        }),
        activeSlot: expect.objectContaining({
          type: DataTypes.TINYINT,
          allowNull: true,
          field: 'active_slot',
        }),
        createdAt: expect.objectContaining({
          type: DataTypes.DATE,
          allowNull: false,
          field: 'created_at',
        }),
      }),
      expect.objectContaining({ tableName: 'EmailConfirmationToken', timestamps: false }),
    );
  });
});
