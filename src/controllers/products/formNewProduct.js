const path = require("path");
const { Category, Franchise } = require("../../database/models");

const formNewProduct = async (req, res) => {
  const categories = await Category.findAll();
  const franchises = await Franchise.findAll();

  const form = path.join(__dirname, "../../views/products/newProduct.ejs");

  res.render(form, { categories, franchises });
};

module.exports = formNewProduct;
