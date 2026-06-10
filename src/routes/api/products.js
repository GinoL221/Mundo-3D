const express = require('express');
const productApiController = require('../../controllers/api/productApiController');

const router = express.Router();

// GET /api/products — all products with category counts
router.get('/products', productApiController.index);

// GET /api/product/:id — single product by ID
router.get('/product/:id', productApiController.show);

// GET /api/products/latest — most recent product
router.get('/products/latest', productApiController.latest);

module.exports = router;
