const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      IDUser: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      FirstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      LastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      Image: {
        type: DataTypes.STRING,
      },
      PasswordUser: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      IDRole: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
      },
      Category: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'User',
      },
    },
    {
      tableName: 'User',
      timestamps: false,
    },
  );

  return User;
};
