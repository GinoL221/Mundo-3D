const { ProductService } = require('../../services');
const path = require('path');

const getAllProducts = async (req, res) => {
  try {
    const allProducts = await ProductService.findAll();

    const ruta = path.join(__dirname, '../../views/products/products.ejs');

    res.render(ruta, { allProducts });
  } catch (error) {
    console.error('Error al obtener todos los productos:', error);
    res.status(500).send('Error interno del servidor');
  }
};

module.exports = getAllProducts;
