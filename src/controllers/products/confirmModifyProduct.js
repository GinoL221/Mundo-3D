const { ProductService } = require('../../services');
const path = require('path');

const confirmModifyProduct = async (req, res, next) => {
  const { id } = req.params;

  try {
    const updated = await ProductService.update(id, {
      NameProduct: req.body.productName,
      Price: req.body.price,
      DescriptionProduct: req.body.description,
    });

    if (!updated) {
      const errorPagePath = path.join(__dirname, '../../views/404notfound');
      return res.render(errorPagePath, { message: 'Product not found' });
    }

    res.redirect('/products');
  } catch (error) {
    console.error('Error al modificar el producto:', error);
    next(error);
  }
};

module.exports = confirmModifyProduct;
