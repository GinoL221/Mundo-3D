const express = require('express');
const { isUser } = require('../middlewares/auth');
const createUpload = require('../middlewares/upload');
const { validationsForm } = require('../middlewares/validators/productValidators');

const router = express.Router();

const uploadImgProduct = createUpload('products');

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
