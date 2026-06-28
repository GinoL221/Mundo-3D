const ShoppingCartDefine = require('../ShoppingCart');
const { DataTypes } = require('sequelize');

describe('ShoppingCart Model Definition', () => {
  it('defines the model with expected camelCase properties, snake_case fields and legacy getterMethods', () => {
    let getterMethodsObj = {};
    const defineMock = jest.fn((name, attributes, options) => {
      getterMethodsObj = options.getterMethods || {};
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

    // Test legacy getters with a mock context object
    const mockInstance = {
      idCart: 1,
      idUser: 10,
      idProduct: 20,
      quantity: 3,
      unitPrice: 15.5,
      cartStatus: 'active',
      getDataValue(key) {
        return this[key];
      }
    };

    expect(getterMethodsObj.IDCart.call(mockInstance)).toBe(1);
    expect(getterMethodsObj.IDUser.call(mockInstance)).toBe(10);
    expect(getterMethodsObj.IDProduct.call(mockInstance)).toBe(20);
    expect(getterMethodsObj.Quantity.call(mockInstance)).toBe(3);
    expect(getterMethodsObj.UnitPrice.call(mockInstance)).toBe(15.5);
    expect(getterMethodsObj.CartStatus.call(mockInstance)).toBe('active');
  });
});
