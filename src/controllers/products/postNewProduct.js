/**
 * @deprecated Replaced by ProductController.postNewProduct in src/infrastructure/controllers/ProductController.ts
 */
const { validationResult } = require('express-validator');
const { ProductService, CategoryService, FranchiseService } = require('../../services');

const postNewProduct = async (req, res, next) => {
  const errors = validationResult(req);

  try {
    const categories = await CategoryService.findAll();
    const franchises = await FranchiseService.findAll();

    if (errors.isEmpty()) {
      const { productName, price, description, category, franchise } = req.body;
      const image = req.file?.filename;

      if (!category || !franchise) {
        return res.status(400).json({ error: 'Category y Franchise son obligatorios' });
      }

      const newProduct = await ProductService.create({
        IDCategory: parseInt(category),
        IDFranchise: parseInt(franchise),
        NameProduct: productName,
        Price: parseFloat(price),
        DescriptionProduct: description,
        Image: image,
      });

      res.redirect('/products');
    } else {
      res.render('products/newProduct', {
        categories,
        franchises,
        errors: errors.mapped(),
        oldData: req.body,
      });
    }
  } catch (error) {
    console.error('Error al manejar el formulario:', error);
    next(error);
  }
};

module.exports = postNewProduct;
