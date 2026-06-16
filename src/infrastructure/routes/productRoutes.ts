import { Router } from 'express';
// @ts-ignore
import { isUser } from '../../middlewares/auth';
// @ts-ignore
import createUpload from '../../middlewares/upload';
// @ts-ignore
import { validationsForm } from '../../middlewares/validators/productValidators';
// @ts-ignore
import { viewShoppingCart } from '../../controllers/products';

import { SequelizeProductRepository } from '../repositories/SequelizeProductRepository';
import { SequelizeCategoryRepository } from '../repositories/SequelizeCategoryRepository';
import { SequelizeFranchiseRepository } from '../repositories/SequelizeFranchiseRepository';

import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase';
import { GetProductByIdUseCase } from '../../application/use-cases/GetProductByIdUseCase';
import { CreateProductUseCase } from '../../application/use-cases/CreateProductUseCase';
import { UpdateProductUseCase } from '../../application/use-cases/UpdateProductUseCase';
import { DeleteProductUseCase } from '../../application/use-cases/DeleteProductUseCase';

import { ProductController } from '../controllers/ProductController';

const router = Router();

// Setup dependency injection
const productRepo = new SequelizeProductRepository();
const categoryRepo = new SequelizeCategoryRepository();
const franchiseRepo = new SequelizeFranchiseRepository();

const listProductsUseCase = new ListProductsUseCase(productRepo);
const getProductByIdUseCase = new GetProductByIdUseCase(productRepo);
const createProductUseCase = new CreateProductUseCase(productRepo, categoryRepo);
const updateProductUseCase = new UpdateProductUseCase(productRepo, categoryRepo);
const deleteProductUseCase = new DeleteProductUseCase(productRepo);

const controller = new ProductController(
  listProductsUseCase,
  getProductByIdUseCase,
  createProductUseCase,
  updateProductUseCase,
  deleteProductUseCase,
  categoryRepo,
  franchiseRepo
);

const uploadImgProduct = createUpload('products');

// Shopping cart route (kept for compatibility, calling legacy controller)
router.get('/productCart', isUser, viewShoppingCart);

// View all products and details
router.get('/products', controller.getAllProducts);
router.get('/product/:id', controller.getProductById);

// Create product routes
router.get('/new-product', isUser, controller.formNewProduct);
router.post('/products', isUser, uploadImgProduct.single('image'), validationsForm, controller.postNewProduct);

// Edit product route
router.put('/product/:id/edit', isUser, controller.confirmModifyProduct);

// Delete product route
router.delete('/product/delete/:id', isUser, controller.deleteProduct);

export default router;
