import { Router } from 'express';
import { SequelizeCategoryRepository } from '../../repositories/SequelizeCategoryRepository';
import { ListCategoriesUseCase } from '../../../application/use-cases/ListCategoriesUseCase';
import { GetCategoryByIdUseCase } from '../../../application/use-cases/GetCategoryByIdUseCase';
import { CreateCategoryUseCase } from '../../../application/use-cases/CreateCategoryUseCase';
import { UpdateCategoryUseCase } from '../../../application/use-cases/UpdateCategoryUseCase';
import { DeleteCategoryUseCase } from '../../../application/use-cases/DeleteCategoryUseCase';
import { CategoryApiController } from '../../controllers/CategoryApiController';
import { apiAuthMiddleware, adminGuard, requireRoles } from '../../middlewares/auth';
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

router.get('/categories', controller.index);
router.get('/categories/:id', controller.show);

router.post(
  '/categories',
  apiAuthMiddleware,
  requireRoles(Role.ADMIN, Role.STAFF),
  categoryCreateValidators,
  handleValidationErrors,
  controller.create
);

router.put(
  '/categories/:id',
  apiAuthMiddleware,
  requireRoles(Role.ADMIN, Role.STAFF),
  categoryUpdateValidators,
  handleValidationErrors,
  controller.update
);

router.delete('/categories/:id', apiAuthMiddleware, adminGuard, controller.destroy);

export default router;
