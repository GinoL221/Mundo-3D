const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RememberToken = sequelize.define(
    'RememberToken',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      IDUser: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      TokenHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      ExpiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'RememberToken',
      timestamps: false,
    }
  );

  return RememberToken;
};
