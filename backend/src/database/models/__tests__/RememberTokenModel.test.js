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

    RememberTokenDefine(mockSequelize);

    expect(defineMock).toHaveBeenCalledWith(
      'RememberToken',
      expect.objectContaining({
        idRememberToken: expect.objectContaining({
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_remember_token',
        }),
        idUser: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'id_user',
        }),
        tokenHash: expect.objectContaining({
          type: DataTypes.STRING(64),
          allowNull: false,
          unique: true,
          field: 'token_hash',
        }),
        expiryDate: expect.objectContaining({
          type: DataTypes.DATE,
          allowNull: false,
          field: 'expiry_date',
        }),
        createdAt: expect.objectContaining({
          type: DataTypes.DATE,
          allowNull: false,
          field: 'created_at',
        }),
        // Rotation columns added by 20260901000000-refresh-token-rotation.js
        // (HIGH-1 PR1) — see design.md D1/D2 and remember-token-store spec.
        familyId: expect.objectContaining({
          type: DataTypes.CHAR(36),
          allowNull: false,
          field: 'family_id',
        }),
        supersededAt: expect.objectContaining({
          type: DataTypes.DATE,
          allowNull: true,
          field: 'superseded_at',
        }),
        successorHash: expect.objectContaining({
          type: DataTypes.STRING(64),
          allowNull: true,
          field: 'successor_hash',
        }),
        revokedAt: expect.objectContaining({
          type: DataTypes.DATE,
          allowNull: true,
          field: 'revoked_at',
        }),
      }),
      expect.objectContaining({
        tableName: 'RememberToken',
        timestamps: false,
      })
    );
  });
});
