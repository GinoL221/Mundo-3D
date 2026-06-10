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
      IDCategory: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      IDFranchise: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
      indexes: [{ unique: false, fields: ['IDCategory'] }],
    },
  );

  return Product;
};
