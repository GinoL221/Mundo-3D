const { validationResult } = require("express-validator");
const { Product, Category, Franchise } = require("../../database/models");
const path = require("path");
const fs = require("fs");

const postNewProduct = async (req, res) => {
  console.log("Datos del formulario:", req.body);
  const errors = validationResult(req);

  try {
    const categories = await Category.findAll();
    const franchises = await Franchise.findAll();

    if (errors.isEmpty()) {
      console.log("entre");
      const { productName, price, description, category, franchise } = req.body;
      const image = req.file.filename;

      if (!category || !franchise) {
        return res
          .status(400)
          .json({ error: "Category y Franchise son obligatorios" });
      }

      if (!req.file) {
        throw new Error("Tienes que subir una imagen");
      }

      const newProduct = await Product.create({
        IDCategory: parseInt(category),
        IDFranchise: parseInt(franchise),
        NameProduct: productName,
        Price: parseFloat(price),
        DescriptionProduct: description,
        Image: image,
      });

      console.log("Producto creado:", newProduct);
      res.redirect("/products");
    } else {
      const ruta = path.join(__dirname, "../../views/products/newProduct.ejs");
      res.render(ruta, {
        categories,
        franchises,
        errors: errors.mapped(),
        oldData: req.body,
      });
    }
  } catch (error) {
    console.error("Error al manejar el formulario:", error);
    res.status(500).send("Error interno del servidor");
  }
};

module.exports = postNewProduct;
