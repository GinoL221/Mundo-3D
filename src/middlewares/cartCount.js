const CartService = require('../services/cartService');

/**
 * Middleware that computes the distinct product count in the user's cart
 * and exposes it as `cartDistinctCount` on res.locals.
 * Hidden when 0 (header template checks `> 0` before rendering badge).
 */
const cartCountMiddleware = async (req, res, next) => {
  res.locals.cartDistinctCount = 0;

  if (res.locals.isLogged && res.locals.userLogged) {
    try {
      const cartItems = await CartService.findByUserId(res.locals.userLogged.IDUser);
      // Count distinct products (each row is a distinct product entry)
      res.locals.cartDistinctCount = cartItems.length;
    } catch (error) {
      // Silently fail — cart count is non-critical
      console.error('Error computing cart count:', error.message);
    }
  }

  next();
};

module.exports = cartCountMiddleware;
