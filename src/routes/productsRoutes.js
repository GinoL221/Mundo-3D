const express = require('express');
const multer = require('multer');
const path = require('path');
const { body } = require('express-validator');
const { isUser, guestMiddleware } = require('../middlewares/auth');

const router = express.Router();

const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, path.join(__dirname, '../../public/img/products'));
  },
  filename: (req, file, callback) => {
    callback(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const uploadImgProduct = multer({ storage: storage });

// Validaciones
const validationsForm = [
  body('productName')
    .trim()
    .notEmpty()
    .withMessage('Debe ingresar un nombre')
    .bail()
    .isString()
    .withMessage('Tienes que ingresar un nombre válido')
    .bail()
    .isLength({ min: 5, max: 20 })
    .withMessage('Tiene que tener entre 5 y 20 caracteres'),

  body('price')
    .trim()
    .notEmpty()
    .withMessage('El precio no puede estar vacío')
    .bail()
    .isNumeric()
    .withMessage('Debe ingresar un número'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Debe ingresar una descripción')
    .bail()
    .isString()
    .withMessage('Tiene que ser un texto')
    .bail()
    .isLength({ max: 40 })
    .withMessage('No puede ser mayor a 40 caracteres'),

  body('category').notEmpty().withMessage('Debe seleccionar una categoría'),

  body('franchise').notEmpty().withMessage('Debe seleccionar una franquicia'),

  body('image').custom((value, { req }) => {
    let file = req.file;
    let acceptedExtensions = ['.jpg', '.png'];
    if (!file) {
      throw new Error('Tienes que subir una imagen');
    } else {
      let fileExtension = path.extname(file.originalname);
      if (!acceptedExtensions.includes(fileExtension)) {
        throw new Error(
          `Las extensiones de archivos permitidas son ${acceptedExtensions.join(', ')}`,
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
} = require('../controllers/products');

//Ruta del carrito de compra
router.get('/productCart', isUser, viewShoppingCart);

//Ruta para ver todos los productos
router.get('/products', getAllProducts);
router.get('/product/:id', getProductById);

//Rutas para crear productos
router.get('/new-product', isUser, formNewProduct);
router.post('/products', isUser, uploadImgProduct.single('image'), validationsForm, postNewProduct);

//Ruta editar un producto
router.put('/product/:id/edit', isUser, confirmModifyProduct);

//Ruta borrar un producto
router.delete('/product/delete/:id', isUser, deleteProduct);

module.exports = router;
