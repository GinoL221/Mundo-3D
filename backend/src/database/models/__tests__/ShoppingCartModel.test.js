const ShoppingCartDefine = require('../ShoppingCart');
const { DataTypes } = require('sequelize');

describe('ShoppingCart Model Definition', () => {
  it('defines the model with expected camelCase properties and snake_case fields', () => {
    const defineMock = jest.fn((name, attributes, options) => {
      return { name, attributes, options };
    });
    const mockSequelize = {
      define: defineMock,
    };

    ShoppingCartDefine(mockSequelize);

    expect(defineMock).toHaveBeenCalledWith(
      'ShoppingCart',
      expect.objectContaining({
        idCart: expect.objectContaining({
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_cart',
        }),
        idUser: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'id_user',
        }),
        idProduct: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'id_product',
        }),
        quantity: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'quantity',
        }),
        unitPrice: expect.objectContaining({
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          field: 'unit_price',
        }),
        cartStatus: expect.objectContaining({
          type: DataTypes.STRING(50),
          allowNull: false,
          field: 'cart_status',
        }),
      }),
      expect.objectContaining({
        tableName: 'ShoppingCart',
        timestamps: false,
      })
    );
  });
});
