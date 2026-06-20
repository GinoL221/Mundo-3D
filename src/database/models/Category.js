const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Category = sequelize.define(
    'Category',
    {
      idCategory: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_category',
      },
      nameCategory: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'name_category',
      },
    },
    {
      tableName: 'Category',
      timestamps: false,
      getterMethods: {
        IDCategory() {
          return this.idCategory;
        },
        NameCategory() {
          return this.nameCategory;
        },
      },
    },
  );

  return Category;
};
