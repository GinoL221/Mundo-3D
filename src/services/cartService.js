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
};

module.exports = CartService;
