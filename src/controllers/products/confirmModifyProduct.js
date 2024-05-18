const { Product } = require("../../database/models");
const path = require("path");

const confirmModifyProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findByPk(id);

    if (!product) {
      // Si no se encuentra el producto, renderiza una página de error
      const errorPagePath = path.join(__dirname, "../../views/404notfound");
      return res.render(errorPagePath, { message: "Product not found" });
    }

    product.NameProduct = req.body.productName;
    product.Price = req.body.price;
    product.DescriptionProduct = req.body.description;

    // Guarda los cambios en la base de datos
    await product.save();

    // Redirecciona a la página de productos después de la modificación
    res.redirect("/products");
  } catch (error) {
    console.error("Error al modificar el producto:", error);
    res.status(500).send("Error interno del servidor");
  }
};

module.exports = confirmModifyProduct;
