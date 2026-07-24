import { Router } from 'express';
import { SequelizeProductRepository } from '../../repositories/SequelizeProductRepository';
import { SequelizeCategoryRepository } from '../../repositories/SequelizeCategoryRepository';
import { ListProductsUseCase } from '../../../application/use-cases/ListProductsUseCase';
import { GetProductByIdUseCase } from '../../../application/use-cases/GetProductByIdUseCase';
import { GetLatestProductUseCase } from '../../../application/use-cases/GetLatestProductUseCase';
import { CreateProductUseCase } from '../../../application/use-cases/CreateProductUseCase';
import { UpdateProductUseCase } from '../../../application/use-cases/UpdateProductUseCase';
import { DeleteProductUseCase } from '../../../application/use-cases/DeleteProductUseCase';
import { AdjustProductStockUseCase } from '../../../application/use-cases/AdjustProductStockUseCase';
import { PinoLogger } from '../../logging/PinoLogger';
import { ProductApiController } from '../../controllers/ProductApiController';
import { apiAuthMiddleware, adminGuard, requireRoles } from '../../middlewares/auth';
import { Role } from '../../../domain/Role';
import { productCreateValidators, productUpdateValidators } from '../../middlewares/validators/productValidators';
import createUpload from '../../middlewares/upload';
import handleValidationErrors from '../../middlewares/handleValidationErrors';

const router = Router();

const productRepo = new SequelizeProductRepository();
const categoryRepo = new SequelizeCategoryRepository();

const listProductsUseCase = new ListProductsUseCase(productRepo);
const getProductByIdUseCase = new GetProductByIdUseCase(productRepo);
const getLatestProductUseCase = new GetLatestProductUseCase(productRepo);
const createProductUseCase = new CreateProductUseCase(productRepo, categoryRepo);
const updateProductUseCase = new UpdateProductUseCase(productRepo, categoryRepo);
const deleteProductUseCase = new DeleteProductUseCase(productRepo);
const adjustProductStockUseCase = new AdjustProductStockUseCase(productRepo, new PinoLogger());

const controller = new ProductApiController(
  listProductsUseCase,
  getProductByIdUseCase,
  getLatestProductUseCase,
  createProductUseCase,
  updateProductUseCase,
  deleteProductUseCase,
  adjustProductStockUseCase
);

const uploadImgProduct = createUpload('products');

router.get('/products', controller.index);
router.get('/product/:id', controller.show);
router.get('/products/latest', controller.latest);

router.post(
  '/products',
  apiAuthMiddleware,
  requireRoles(Role.ADMIN, Role.STAFF),
  uploadImgProduct.single('image'),
  productCreateValidators,
  handleValidationErrors,
  controller.create
);

router.put(
  '/products/:id',
  apiAuthMiddleware,
  requireRoles(Role.ADMIN, Role.STAFF),
  uploadImgProduct.single('image'),
  productUpdateValidators,
  handleValidationErrors,
  controller.update
);

router.delete('/products/:id', apiAuthMiddleware, adminGuard, controller.destroy);

router.patch(
  '/products/:id/stock',
  apiAuthMiddleware,
  requireRoles(Role.ADMIN, Role.STAFF),
  controller.adjustStock
);

export default router;
