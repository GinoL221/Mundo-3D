const { ShoppingCart, Product, User } = require("../../database/models");
const path = require("path");

const calcularTotal = (userShoppingCart) => {
  let total = 0;
  userShoppingCart.forEach((cartItem) => {
    total += cartItem.product.Price * cartItem.Quantity;
  });
  return total;
};

const viewShoppingCart = (req, res) => {
  const userId = req.session.userLogged.IDUser;

  ShoppingCart.findAll({
    where: { IDUser: userId },
    include: [{ model: Product, as: "product" }],
  })
    .then((userShoppingCart) => {
      console.log("Carrito de compras:", userShoppingCart);

      const ruta = path.join(__dirname, "../../views/products/productCart.ejs");
      res.render(ruta, { userShoppingCart, calcularTotal });
    })
    .catch((error) => {
      console.error("Error al obtener el carrito de compras", error);
      res.status(500).send("Error interno del servidor");
    });
};

module.exports = viewShoppingCart;
