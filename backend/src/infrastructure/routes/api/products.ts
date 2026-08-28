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
import { csrfGuard } from '../../middlewares/csrf';
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

/**
 * @openapi
 * /products:
 *   get:
 *     summary: List all products, with a per-category count breakdown
 *     tags: [Products]
 *     responses:
 *       '200':
 *         description: Products plus counts.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ListProductsResponse' }
 *   post:
 *     summary: Create a product (ADMIN/STAFF)
 *     tags: [Products]
 *     security: [{ cookieAuth: [], csrfHeader: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nameProduct: { type: string, minLength: 5, maxLength: 20 }
 *               price: { type: number, exclusiveMinimum: 0 }
 *               descriptionProduct: { type: string, maxLength: 40 }
 *               idCategory: { type: integer }
 *               idFranchise: { type: integer }
 *               image: { type: string, format: binary, description: 'Required; .jpg/.png only.' }
 *               material: { type: string, nullable: true }
 *               height: { type: number, minimum: 0, nullable: true }
 *               width: { type: number, minimum: 0, nullable: true }
 *               depth: { type: number, minimum: 0, nullable: true }
 *               finish: { type: string, nullable: true }
 *               productionTime: { type: integer, minimum: 1, nullable: true }
 *               stock: { type: integer, minimum: 0, description: 'Defaults to 0 when omitted.' }
 *             required: [nameProduct, price, descriptionProduct, idCategory, idFranchise, image]
 *     responses:
 *       '201':
 *         description: Product created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       '400': { description: Validation error. }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN/STAFF. }
 * /product/{id}:
 *   get:
 *     summary: Get one product by id
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The product.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       '400': { description: Non-numeric id. }
 *       '404': { description: Product not found. }
 * /products/latest:
 *   get:
 *     summary: Get the most recently created product
 *     tags: [Products]
 *     responses:
 *       '200':
 *         description: The latest product.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       '404': { description: No products available. }
 * /products/{id}:
 *   put:
 *     summary: Update a product (ADMIN/STAFF) — never modifies stock
 *     description: All body fields optional (partial update). `stock` is intentionally ignored even if sent — stock mutation happens exclusively via PATCH /products/{id}/stock.
 *     tags: [Products]
 *     security: [{ cookieAuth: [], csrfHeader: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nameProduct: { type: string, minLength: 5, maxLength: 20 }
 *               price: { type: number, exclusiveMinimum: 0 }
 *               descriptionProduct: { type: string, maxLength: 40 }
 *               idCategory: { type: integer }
 *               idFranchise: { type: integer }
 *               image: { type: string, format: binary, description: 'Optional; .jpg/.png only.' }
 *               material: { type: string, nullable: true }
 *               height: { type: number, minimum: 0, nullable: true }
 *               width: { type: number, minimum: 0, nullable: true }
 *               depth: { type: number, minimum: 0, nullable: true }
 *               finish: { type: string, nullable: true }
 *               productionTime: { type: integer, minimum: 1, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated product.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       '400': { description: Non-numeric id or validation error. }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN/STAFF. }
 *       '404': { description: Product not found. }
 *   delete:
 *     summary: Delete a product (ADMIN only)
 *     tags: [Products]
 *     security: [{ cookieAuth: [], csrfHeader: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '204': { description: Deleted. }
 *       '400': { description: Non-numeric id. }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN. }
 *       '404': { description: Product not found. }
 * /products/{id}/stock:
 *   patch:
 *     summary: Adjust a product's stock by a signed delta (ADMIN/STAFF)
 *     tags: [Products]
 *     security: [{ cookieAuth: [], csrfHeader: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { delta: { type: integer, description: 'Non-zero integer; negative decreases stock.' } }
 *             required: [delta]
 *     responses:
 *       '200':
 *         description: Updated product.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       '400': { description: delta is not a non-zero integer. }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN/STAFF. }
 *       '404': { description: Product not found. }
 *       '409': { description: Insufficient stock for the requested decrease. }
 */
router.get('/products', controller.index);
router.get('/product/:id', controller.show);
router.get('/products/latest', controller.latest);

router.post(
  '/products',
  apiAuthMiddleware,
  csrfGuard,
  requireRoles(Role.ADMIN, Role.STAFF),
  uploadImgProduct.single('image'),
  productCreateValidators,
  handleValidationErrors,
  controller.create
);

router.put(
  '/products/:id',
  apiAuthMiddleware,
  csrfGuard,
  requireRoles(Role.ADMIN, Role.STAFF),
  uploadImgProduct.single('image'),
  productUpdateValidators,
  handleValidationErrors,
  controller.update
);

router.delete('/products/:id', apiAuthMiddleware, csrfGuard, adminGuard, controller.destroy);

router.patch(
  '/products/:id/stock',
  apiAuthMiddleware,
  csrfGuard,
  requireRoles(Role.ADMIN, Role.STAFF),
  controller.adjustStock
);

export default router;
