/**
 * @deprecated Legacy Product controllers barrel.
 * Replaced by the Hexagonal/Clean Architecture implementation in:
 * - src/infrastructure/controllers/ProductController.ts
 * Kept on disk for compatibility with legacy tests.
 */

const getAllProducts = require('./getAllProducts');
const getProductById = require('./getProductById');
const formNewProduct = require('./formNewProduct');
const postNewProduct = require('./postNewProduct');
const deleteProduct = require('./deleteProduct');
const confirmModifyProduct = require('./confirmModifyProduct');

module.exports = {
  getAllProducts,
  formNewProduct,
  postNewProduct,
  deleteProduct,
  getProductById,
  confirmModifyProduct,
};
