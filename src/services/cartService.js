const { ShoppingCart, Product } = require('../database/models/db');

const CartService = {
  async findByUserId(userId) {
    return ShoppingCart.findAll({
      where: { IDUser: userId },
      include: [{ model: Product, as: 'product' }],
    });
  },

  async findAll() {
    return ShoppingCart.findAll();
  },

  computeTotal(cartItems) {
    return cartItems.reduce(
      (sum, item) => sum + (item.product?.Price || item.Price || 0) * (item.Quantity || 0),
      0,
    );
  },
};

module.exports = CartService;
