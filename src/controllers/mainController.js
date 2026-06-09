const path = require('path');
const ProductService = require('../services/productService');

const mainController = {
  async index(req, res) {
    try {
      const products = await ProductService.findAll();
      const ruta = path.join(__dirname, '../views/index');
      res.render(ruta, { products });
    } catch (error) {
      console.error('Error loading homepage:', error);
      const ruta = path.join(__dirname, '../views/index');
      res.render(ruta, { products: [] });
    }
  },
};

module.exports = mainController;
