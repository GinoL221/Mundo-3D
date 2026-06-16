/**
 * @deprecated Replaced by ProductController.getProductById in src/infrastructure/controllers/ProductController.ts
 */
const { ProductService } = require('../../services');
const path = require('path');

const getProductById = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const product = await ProductService.findById(productId);

    if (!product) {
      return res.render(path.join(__dirname, '../../views/404NotFound'), {
        message: 'Product not found',
      });
    }

    const ruta = path.join(__dirname, '../../views/products/productDetail.ejs');
    res.render(ruta, { product });
  } catch (error) {
    console.error('Error al obtener detalles del producto:', error);
    next(error);
  }
};

module.exports = getProductById;
