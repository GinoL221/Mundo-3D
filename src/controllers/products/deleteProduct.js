const { ProductService } = require('../../services');

const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await ProductService.remove(id);

    if (!deleted) {
      return res.status(404).send('Producto no encontrado');
    }

    res.redirect('/products');
  } catch (error) {
    console.error('Error al eliminar el producto:', error);
    res.status(500).send('Error interno del servidor');
  }
};

module.exports = deleteProduct;
