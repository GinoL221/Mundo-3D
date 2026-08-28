const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderItem = sequelize.define(
    'OrderItem',
    {
      idOrderItem: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_order_item',
      },
      idOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_order',
      },
      idProduct: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'id_product',
      },
      productName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'product_name',
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
    },
    {
      tableName: 'OrderItem',
      timestamps: false,
    },
  );

  return OrderItem;
};
