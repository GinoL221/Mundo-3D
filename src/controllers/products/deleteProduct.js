/**
 * @deprecated Replaced by ProductController.deleteProduct in src/infrastructure/controllers/ProductController.ts
 */
const { ProductService } = require('../../services');

const deleteProduct = async (req, res, next) => {
  const { id } = req.params;

  try {
    const deleted = await ProductService.remove(id);

    if (!deleted) {
      return res.status(404).send('Producto no encontrado');
    }

    res.redirect('/products');
  } catch (error) {
    console.error('Error al eliminar el producto:', error);
    next(error);
  }
};

module.exports = deleteProduct;
