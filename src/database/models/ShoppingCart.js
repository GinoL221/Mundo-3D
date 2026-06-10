const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ShoppingCart = sequelize.define(
    'ShoppingCart',
    {
      IDCart: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      IDUser: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      IDProduct: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      Quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      UnitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      CartStatus: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
    },
    {
      tableName: 'ShoppingCart',
      timestamps: false,
    },
  );

  return ShoppingCart;
};
