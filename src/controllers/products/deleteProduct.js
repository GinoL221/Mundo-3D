const { Product } = require("../../database/models");

const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    // Buscar el producto en la base de datos
    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).send("Producto no encontrado");
    }

    // Eliminar el producto
    await product.destroy();

    res.redirect("/products");
  } catch (error) {
    console.error("Error al eliminar el producto:", error);
    res.status(500).send("Error interno del servidor");
  }
};

module.exports = deleteProduct;
