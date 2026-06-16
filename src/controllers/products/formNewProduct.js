/**
 * @deprecated Replaced by ProductController.formNewProduct in src/infrastructure/controllers/ProductController.ts
 */
const path = require('path');
const { CategoryService, FranchiseService } = require('../../services');

const formNewProduct = async (req, res) => {
  const categories = await CategoryService.findAll();
  const franchises = await FranchiseService.findAll();

  const form = path.join(__dirname, '../../views/products/newProduct.ejs');

  res.render(form, { categories, franchises });
};

module.exports = formNewProduct;
