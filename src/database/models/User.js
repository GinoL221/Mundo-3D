const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const User = sequelize.define(
    "User",
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
    },
    {
      tableName: "User",
      timestamps: false,
    }
  );

  return User;
};
