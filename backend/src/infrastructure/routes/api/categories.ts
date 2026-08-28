import { Router } from 'express';
import { SequelizeCategoryRepository } from '../../repositories/SequelizeCategoryRepository';
import { ListCategoriesUseCase } from '../../../application/use-cases/ListCategoriesUseCase';
import { GetCategoryByIdUseCase } from '../../../application/use-cases/GetCategoryByIdUseCase';
import { CreateCategoryUseCase } from '../../../application/use-cases/CreateCategoryUseCase';
import { UpdateCategoryUseCase } from '../../../application/use-cases/UpdateCategoryUseCase';
import { DeleteCategoryUseCase } from '../../../application/use-cases/DeleteCategoryUseCase';
import { CategoryApiController } from '../../controllers/CategoryApiController';
import { apiAuthMiddleware, adminGuard, requireRoles } from '../../middlewares/auth';
import { csrfGuard } from '../../middlewares/csrf';
import { Role } from '../../../domain/Role';
import { categoryCreateValidators, categoryUpdateValidators } from '../../middlewares/validators/categoryValidators';
import handleValidationErrors from '../../middlewares/handleValidationErrors';

const router = Router();

const categoryRepo = new SequelizeCategoryRepository();

const listCategoriesUseCase = new ListCategoriesUseCase(categoryRepo);
const getCategoryByIdUseCase = new GetCategoryByIdUseCase(categoryRepo);
const createCategoryUseCase = new CreateCategoryUseCase(categoryRepo);
const updateCategoryUseCase = new UpdateCategoryUseCase(categoryRepo);
const deleteCategoryUseCase = new DeleteCategoryUseCase(categoryRepo);

const controller = new CategoryApiController(
  listCategoriesUseCase,
  getCategoryByIdUseCase,
  createCategoryUseCase,
  updateCategoryUseCase,
  deleteCategoryUseCase
);

/**
 * @openapi
 * /categories:
 *   get:
 *     summary: List all categories
 *     tags: [Categories]
 *     responses:
 *       '200':
 *         description: All categories.
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/Category' } }
 *   post:
 *     summary: Create a category (ADMIN/STAFF)
 *     tags: [Categories]
 *     security: [{ cookieAuth: [], csrfHeader: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { nameCategory: { type: string, description: Required, trimmed, non-empty. } }
 *             required: [nameCategory]
 *     responses:
 *       '201':
 *         description: Category created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Category' }
 *       '400': { description: Validation error (missing/blank nameCategory). }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN/STAFF. }
 *       '409': { description: DUPLICATE_CATEGORY_NAME. }
 * /categories/{id}:
 *   get:
 *     summary: Get one category by id
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The category.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Category' }
 *       '400': { description: Non-numeric id. }
 *       '404': { description: Category not found. }
 *   put:
 *     summary: Update a category (ADMIN/STAFF)
 *     tags: [Categories]
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
 *             properties: { nameCategory: { type: string, description: Required, trimmed, non-empty. } }
 *             required: [nameCategory]
 *     responses:
 *       '200':
 *         description: Updated category.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Category' }
 *       '400': { description: Non-numeric id or validation error. }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN/STAFF. }
 *       '404': { description: Category not found. }
 *       '409': { description: DUPLICATE_CATEGORY_NAME. }
 *   delete:
 *     summary: Delete a category (ADMIN only)
 *     tags: [Categories]
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
 *       '404': { description: Category not found. }
 *       '409': { description: Category has associated products. }
 */
router.get('/categories', controller.index);
router.get('/categories/:id', controller.show);

router.post(
  '/categories',
  apiAuthMiddleware,
  csrfGuard,
  requireRoles(Role.ADMIN, Role.STAFF),
  categoryCreateValidators,
  handleValidationErrors,
  controller.create
);

router.put(
  '/categories/:id',
  apiAuthMiddleware,
  csrfGuard,
  requireRoles(Role.ADMIN, Role.STAFF),
  categoryUpdateValidators,
  handleValidationErrors,
  controller.update
);

router.delete('/categories/:id', apiAuthMiddleware, csrfGuard, adminGuard, controller.destroy);

export default router;
