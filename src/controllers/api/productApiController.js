const { ProductService } = require('../../services');

const productApiController = {
  async index(req, res, next) {
    try {
      const products = await ProductService.findAll();
      const { count, countByCategory, products: mappedProducts } =
        ProductService.transformWithCategoryCount(products);
      res.json({ count, countByCategory, products: mappedProducts });
    } catch (error) {
      next(error);
    }
  },

  async show(req, res, next) {
    const { id } = req.params;
    try {
      const product = await ProductService.findById(id);
      if (!product) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      res.json(product);
    } catch (error) {
      next(error);
    }
  },

  async latest(req, res, next) {
    try {
      const latestProduct = await ProductService.findLatest();
      if (!latestProduct) {
        return res.status(404).json({ error: 'No hay productos disponibles.' });
      }
      const mappedLatestProduct = {
        IDProduct: latestProduct.IDProduct,
        NameProduct: latestProduct.NameProduct,
        Price: latestProduct.Price,
        DescriptionProduct: latestProduct.DescriptionProduct,
        Image: latestProduct.Image,
        Category: latestProduct.Category ? latestProduct.Category.NameCategory : 'Sin categoría',
      };
      res.json(mappedLatestProduct);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = productApiController;
