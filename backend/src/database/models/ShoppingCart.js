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
      getterMethods: {
        /** @deprecated Use camelCase attribute `idCart` instead. */
        IDCart() {
          return this.getDataValue('idCart');
        },
        /** @deprecated Use camelCase attribute `idUser` instead. */
        IDUser() {
          return this.getDataValue('idUser');
        },
        /** @deprecated Use camelCase attribute `idProduct` instead. */
        IDProduct() {
          return this.getDataValue('idProduct');
        },
        /** @deprecated Use camelCase attribute `quantity` instead. */
        Quantity() {
          return this.getDataValue('quantity');
        },
        /** @deprecated Use camelCase attribute `unitPrice` instead. */
        UnitPrice() {
          return this.getDataValue('unitPrice');
        },
        /** @deprecated Use camelCase attribute `cartStatus` instead. */
        CartStatus() {
          return this.getDataValue('cartStatus');
        },
      },
    },
  );

  return ShoppingCart;
};
