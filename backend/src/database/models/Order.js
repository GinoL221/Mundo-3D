const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define(
    'Order',
    {
      idOrder: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_order',
      },
      idUser: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_user',
      },
      idempotencyKey: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'idempotency_key',
      },
      orderStatus: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'AWAITING_PAYMENT',
        field: 'order_status',
      },
      paymentReference: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'payment_reference',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
    },
    {
      tableName: 'Order',
      timestamps: false,
    },
  );

  return Order;
};
