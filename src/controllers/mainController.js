const ProductService = require('../services/productService');

const mainController = {
  async index(req, res) {
    try {
      const products = await ProductService.findAll();
      res.render('index', { products });
    } catch (error) {
      console.error('Error loading homepage:', error);
      res.render('index', { products: [] });
    }
  },
};

module.exports = mainController;
