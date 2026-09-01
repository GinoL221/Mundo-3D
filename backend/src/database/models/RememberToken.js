const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RememberToken = sequelize.define(
    'RememberToken',
    {
      idRememberToken: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_remember_token',
      },
      idUser: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_user',
      },
      tokenHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        field: 'token_hash',
      },
      expiryDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expiry_date',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
        defaultValue: DataTypes.NOW,
      },
      // Rotation columns added by 20260901000000-refresh-token-rotation.js
      // (HIGH-1 PR1) — see design.md D1/D2 and the remember-token-store spec.
      familyId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'family_id',
      },
      supersededAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'superseded_at',
      },
      successorHash: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: 'successor_hash',
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'revoked_at',
      },
    },
    {
      tableName: 'RememberToken',
      timestamps: false,
      getterMethods: {
        IDRememberToken() {
          return this.idRememberToken;
        },
        IDUser() {
          return this.idUser;
        },
        TokenHash() {
          return this.tokenHash;
        },
        ExpiresAt() {
          return this.expiryDate;
        },
        CreatedAt() {
          return this.createdAt;
        },
      },
    }
  );

  return RememberToken;
};
