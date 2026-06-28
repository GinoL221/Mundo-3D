const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ShoppingCart = sequelize.define(
    'ShoppingCart',
    {
      idCart: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_cart',
      },
      idUser: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_user',
      },
      idProduct: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_product',
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'quantity',
      },
      unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'unit_price',
      },
      cartStatus: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'cart_status',
      },
    },
    {
      tableName: 'ShoppingCart',
      timestamps: false,
    },
  );

  return ShoppingCart;
};
