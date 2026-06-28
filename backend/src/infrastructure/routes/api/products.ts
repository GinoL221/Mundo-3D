import { Router } from 'express';
import { SequelizeProductRepository } from '../../repositories/SequelizeProductRepository';
import { ListProductsUseCase } from '../../../application/use-cases/ListProductsUseCase';
import { GetProductByIdUseCase } from '../../../application/use-cases/GetProductByIdUseCase';
import { GetLatestProductUseCase } from '../../../application/use-cases/GetLatestProductUseCase';
import { ProductApiController } from '../../controllers/ProductApiController';

const router = Router();

const productRepo = new SequelizeProductRepository();
const listProductsUseCase = new ListProductsUseCase(productRepo);
const getProductByIdUseCase = new GetProductByIdUseCase(productRepo);
const getLatestProductUseCase = new GetLatestProductUseCase(productRepo);

const controller = new ProductApiController(
  listProductsUseCase,
  getProductByIdUseCase,
  getLatestProductUseCase
);

router.get('/products', controller.index);
router.get('/product/:id', controller.show);
router.get('/products/latest', controller.latest);

export default router;
