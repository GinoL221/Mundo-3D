/**
 * Kept for compatibility. This controller handles the shopping cart view,
 * which remains legacy while the Product domain has been migrated to Hexagonal Architecture.
 */
const { CartService } = require('../../services');

const viewShoppingCart = (req, res, next) => {
  const userId = req.session.userLogged.IDUser;

  CartService.findByUserId(userId)
    .then((userShoppingCart) => {
      res.render('products/productCart', {
        userShoppingCart,
        total: CartService.computeTotal(userShoppingCart),
      });
    })
    .catch((error) => {
      console.error('Error al obtener el carrito de compras', error);
      next(error);
    });
};

module.exports = viewShoppingCart;
