const { Product, Category, Franchise } = require("../../database/models");
const path = require("path");

const getAllProducts = async (req, res) => {
  try {
    const allProducts = await Product.findAll({
      include: [
        {
          model: Category,
          as: "Category",
          attributes: ["IDCategory", "NameCategory"],
        },
        {
          model: Franchise,
          as: "Franchise",
          attributes: ["IDFranchise", "NameFranchise"],
        },
      ],
    });

    const ruta = path.join(__dirname, "../../views/products/products.ejs");

    res.render(ruta, { allProducts });
  } catch (error) {
    console.error("Error al obtener todos los productos:", error);
    res.status(500).send("Error interno del servidor");
  }
};

module.exports = getAllProducts;
