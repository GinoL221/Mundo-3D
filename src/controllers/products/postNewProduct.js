const { validationResult } = require('express-validator');
const { ProductService, CategoryService, FranchiseService } = require('../../services');
const path = require('path');

const postNewProduct = async (req, res) => {
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

      if (!req.file) {
        throw new Error('Tienes que subir una imagen');
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
      const ruta = path.join(__dirname, '../../views/products/newProduct.ejs');
      res.render(ruta, {
        categories,
        franchises,
        errors: errors.mapped(),
        oldData: req.body,
      });
    }
  } catch (error) {
    console.error('Error al manejar el formulario:', error);
    res.status(500).send('Error interno del servidor');
  }
};

module.exports = postNewProduct;
