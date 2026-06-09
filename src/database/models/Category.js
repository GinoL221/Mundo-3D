const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Category = sequelize.define(
    'Category',
    {
      IDCategory: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      NameCategory: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: 'Category',
      timestamps: false,
    },
  );

  return Category;
};
