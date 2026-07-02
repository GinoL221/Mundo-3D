import { Router, Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { SequelizeProductRepository } from '../../repositories/SequelizeProductRepository';
import { SequelizeCategoryRepository } from '../../repositories/SequelizeCategoryRepository';
import { ListProductsUseCase } from '../../../application/use-cases/ListProductsUseCase';
import { GetProductByIdUseCase } from '../../../application/use-cases/GetProductByIdUseCase';
import { GetLatestProductUseCase } from '../../../application/use-cases/GetLatestProductUseCase';
import { CreateProductUseCase } from '../../../application/use-cases/CreateProductUseCase';
import { UpdateProductUseCase } from '../../../application/use-cases/UpdateProductUseCase';
import { DeleteProductUseCase } from '../../../application/use-cases/DeleteProductUseCase';
import { AdjustProductStockUseCase } from '../../../application/use-cases/AdjustProductStockUseCase';
import { ProductApiController } from '../../controllers/ProductApiController';
import { apiAuthMiddleware, requireRoles } from '../../middlewares/auth';
import { Role } from '../../../domain/Role';
import { productCreateValidators, productUpdateValidators } from '../../middlewares/validators/productValidators';
import createUpload from '../../middlewares/upload';

const router = Router();

const productRepo = new SequelizeProductRepository();
const categoryRepo = new SequelizeCategoryRepository();

const listProductsUseCase = new ListProductsUseCase(productRepo);
const getProductByIdUseCase = new GetProductByIdUseCase(productRepo);
const getLatestProductUseCase = new GetLatestProductUseCase(productRepo);
const createProductUseCase = new CreateProductUseCase(productRepo, categoryRepo);
const updateProductUseCase = new UpdateProductUseCase(productRepo, categoryRepo);
const deleteProductUseCase = new DeleteProductUseCase(productRepo);
const adjustProductStockUseCase = new AdjustProductStockUseCase(productRepo);

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

// Mirrors `routes/api/users.ts`'s `handleValidationErrors` pattern: run as a
// dedicated route-level middleware after the field validators, so
// `ProductApiController.create`/`update` can assume validation already
// passed and don't need to re-check `validationResult` themselves.
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

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

router.delete('/products/:id', apiAuthMiddleware, requireRoles(Role.ADMIN), controller.destroy);

router.patch(
  '/products/:id/stock',
  apiAuthMiddleware,
  requireRoles(Role.ADMIN, Role.STAFF),
  controller.adjustStock
);

export default router;
