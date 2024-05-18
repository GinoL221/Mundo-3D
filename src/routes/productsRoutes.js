const express = require("express");
const multer = require("multer");
const path = require("path");
const { Op } = require("sequelize");
const { sequelize, Category, Product } = require("../database/models");
const { body } = require("express-validator");
const {
  isUser,
  guestMiddleware,
  authMiddleware,
} = require("../middlewares/adminMiddlewares");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, path.join(__dirname, "../../public/img/products"));
  },
  filename: (req, file, callback) => {
    const { v4: uuidv4 } = require("uuid");
    callback(
      null,
      `${uuidv4()}_${req.body.productName}${path.extname(file.originalname)}`
    );
  },
});

const uploadImgProduct = multer({ storage: storage });

// Validaciones
const validationsForm = [
  body("productName")
    .trim()
    .notEmpty()
    .withMessage("Debe ingresar un nombre")
    .bail()
    .isString()
    .withMessage("Tienes que ingresar un nombre válido")
    .bail()
    .isLength({ min: 5, max: 20 })
    .withMessage("Tiene que tener entre 5 y 20 caracteres"),

  body("price")
    .trim()
    .notEmpty()
    .withMessage("El precio no puede estar vacío")
    .bail()
    .isNumeric()
    .withMessage("Debe ingresar un número"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Debe ingresar una descripción")
    .bail()
    .isString()
    .withMessage("Tiene que ser un texto")
    .bail()
    .isLength({ max: 40 })
    .withMessage("No puede ser mayor a 40 caracteres"),

  body("category").notEmpty().withMessage("Debe seleccionar una categoría"),

  body("franchise").notEmpty().withMessage("Debe seleccionar una franquicia"),

  body("image").custom((value, { req }) => {
    let file = req.file;
    let acceptedExtensions = [".jpg", ".png"];
    if (!file) {
      throw new Error("Tienes que subir una imagen");
    } else {
      let fileExtension = path.extname(file.originalname);
      if (!acceptedExtensions.includes(fileExtension)) {
        throw new Error(
          `Las extensiones de archivos permitidas son ${acceptedExtensions.join(
            ", "
          )}`
        );
      }
    }
    return true;
  }),
];

const {
  getAllProducts,
  getProductById,
  formNewProduct,
  postNewProduct,
  deleteProduct,
  confirmModifyProduct,
  viewShoppingCart,
} = require("../controllers/products");

//Ruta del carrito de compra
router.get("/productCart", isUser, viewShoppingCart);

//Ruta para ver todos los productos
router.get("/products", getAllProducts);
router.get("/product/:id", getProductById);

//Rutas para crear productos
router.get("/new-product", isUser, formNewProduct);
router.post(
  "/products",
  isUser,
  uploadImgProduct.single("image"),
  validationsForm,
  postNewProduct
);

//Ruta editar un producto
router.put("/product/:id/edit", isUser, confirmModifyProduct);

//Ruta borrar un producto
router.delete("/product/delete/:id", isUser, deleteProduct);

// ********* API ROUTES **************
// Obtener todos los productos
router.get("/api/products", async (req, res) => {
  try {
    const products = await Product.findAll({
      include: {
        model: Category,
        as: "Category",
      },
    });

    const countByCategory = {};

    // Mapear productos para incluir solo la información necesaria de Category
    const mappedProducts = products.map((product) => {
      const categoryName = product.Category ? product.Category.NameCategory : "Sin categoría";

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

      // Retornar solo la información necesaria del producto
      return {
        IDProduct: product.IDProduct,
        NameProduct: product.NameProduct,
        Price: product.Price,
        DescriptionProduct: product.DescriptionProduct,
        Image: product.Image,
        Category: categoryName, // Cambiar de product.NameCategory a categoryName
      };
    });

    const count = products.length;

    const obj = { count, countByCategory, products: mappedProducts };
    res.json(obj);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Obtener un producto por ID
router.get("/api/product/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json(product);
  } catch (error) {
    console.error("Error al obtener el producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Obtener el último producto agregado
router.get("/api/products/latest", async (req, res) => {
  try {
    const latestProduct = await Product.findOne({
      include: {
        model: Category,
        as: "Category",
      },
      order: [['IDProduct', 'DESC']], // Ordena por IDProduct de forma descendente para obtener el último
    });

    if (!latestProduct) {
      return res.status(404).json({ error: "No hay productos disponibles." });
    }

    // Mapear la información necesaria
    const mappedLatestProduct = {
      IDProduct: latestProduct.IDProduct,
      NameProduct: latestProduct.NameProduct,
      Price: latestProduct.Price,
      DescriptionProduct: latestProduct.DescriptionProduct,
      Image: latestProduct.Image,
      Category: latestProduct.Category ? latestProduct.Category.NameCategory : "Sin categoría",
    };

    res.json(mappedLatestProduct);
  } catch (error) {
    console.error("Error al obtener el último producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


module.exports = router;
