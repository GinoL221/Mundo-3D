const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define(
    'EmailConfirmationToken',
    {
      idEmailConfirmationToken: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_email_confirmation_token',
      },
      idUser: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_user',
      },
      tokenHash: {
        type: DataTypes.CHAR(64),
        allowNull: false,
        unique: true,
        field: 'token_hash',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at',
      },
      consumedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'consumed_at',
      },
      invalidatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'invalidated_at',
      },
      activeSlot: {
        type: DataTypes.TINYINT,
        allowNull: true,
        field: 'active_slot',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
    },
    {
      tableName: 'EmailConfirmationToken',
      timestamps: false,
    },
  );
};
