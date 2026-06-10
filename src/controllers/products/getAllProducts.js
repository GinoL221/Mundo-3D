const { ProductService } = require('../../services');
const path = require('path');

const getAllProducts = async (req, res, next) => {
  try {
    const allProducts = await ProductService.findAll();

    const ruta = path.join(__dirname, '../../views/products/products.ejs');

    res.render(ruta, { allProducts });
  } catch (error) {
    console.error('Error al obtener todos los productos:', error);
    next(error);
  }
};

module.exports = getAllProducts;
