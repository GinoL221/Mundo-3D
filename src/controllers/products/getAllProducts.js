const { ProductService } = require('../../services');

const getAllProducts = async (req, res, next) => {
  try {
    const allProducts = await ProductService.findAll();

    res.render('products/products', { allProducts });
  } catch (error) {
    console.error('Error al obtener todos los productos:', error);
    next(error);
  }
};

module.exports = getAllProducts;
