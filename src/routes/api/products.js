const express = require('express');
const { ProductService } = require('../../services');

const router = express.Router();

// GET /api/products — all products with category counts
router.get('/products', async (req, res) => {
  try {
    const products = await ProductService.findAll();

    const countByCategory = {};

    const mappedProducts = products.map((product) => {
      const categoryName = product.Category ? product.Category.NameCategory : 'Sin categoría';

      const categoryInfo = product.Category
        ? {
            IDCategory: product.Category.IDCategory,
            IDType: product.Category.IDType,
          }
        : null;

      if (!countByCategory[categoryName]) {
        countByCategory[categoryName] = {
          count: 1,
          category: categoryInfo,
        };
      } else {
        countByCategory[categoryName].count++;
      }

      return {
        IDProduct: product.IDProduct,
        NameProduct: product.NameProduct,
        Price: product.Price,
        DescriptionProduct: product.DescriptionProduct,
        Image: product.Image,
        Category: categoryName,
      };
    });

    const count = products.length;
    res.json({ count, countByCategory, products: mappedProducts });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/product/:id — single product by ID
router.get('/product/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const product = await ProductService.findById(id);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error al obtener el producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/products/latest — most recent product
router.get('/products/latest', async (req, res) => {
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
    console.error('Error al obtener el último producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
