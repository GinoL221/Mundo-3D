const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define(
    'Product',
    {
      IDProduct: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      idCategory: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_category',
      },
      idFranchise: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_franchise',
      },
      NameProduct: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      DescriptionProduct: {
        type: DataTypes.TEXT,
      },
      Image: {
        type: DataTypes.STRING,
      },
    },
    {
      tableName: 'Product',
      timestamps: false,
      indexes: [{ unique: false, fields: ['id_category'] }],
      getterMethods: {
        IDCategory() {
          return this.idCategory;
        },
        IDFranchise() {
          return this.idFranchise;
        },
      },
    },
  );

  return Product;
};
