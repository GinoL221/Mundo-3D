import { Router } from 'express';
import { ListFranchisesUseCase } from '../../../application/use-cases/ListFranchisesUseCase';
import { GetFranchiseByIdUseCase } from '../../../application/use-cases/GetFranchiseByIdUseCase';
import { CreateFranchiseUseCase } from '../../../application/use-cases/CreateFranchiseUseCase';
import { UpdateFranchiseUseCase } from '../../../application/use-cases/UpdateFranchiseUseCase';
import { DeleteFranchiseUseCase } from '../../../application/use-cases/DeleteFranchiseUseCase';
import { Role } from '../../../domain/Role';
import { FranchiseApiController } from '../../controllers/FranchiseApiController';
import { apiAuthMiddleware, adminGuard, requireRoles } from '../../middlewares/auth';
import handleValidationErrors from '../../middlewares/handleValidationErrors';
import {
  franchiseCreateValidators,
  franchiseUpdateValidators,
} from '../../middlewares/validators/franchiseValidators';
import { SequelizeFranchiseRepository } from '../../repositories/SequelizeFranchiseRepository';

const router = Router();
const franchiseRepo = new SequelizeFranchiseRepository();
const controller = new FranchiseApiController(
  new ListFranchisesUseCase(franchiseRepo),
  new GetFranchiseByIdUseCase(franchiseRepo),
  new CreateFranchiseUseCase(franchiseRepo),
  new UpdateFranchiseUseCase(franchiseRepo),
  new DeleteFranchiseUseCase(franchiseRepo),
);

router.get('/franchises', controller.index);
router.get('/franchises/:id', controller.show);
router.post(
  '/franchises',
  apiAuthMiddleware,
  requireRoles(Role.ADMIN, Role.STAFF),
  franchiseCreateValidators,
  handleValidationErrors,
  controller.create,
);
router.put(
  '/franchises/:id',
  apiAuthMiddleware,
  requireRoles(Role.ADMIN, Role.STAFF),
  franchiseUpdateValidators,
  handleValidationErrors,
  controller.update,
);
router.delete('/franchises/:id', apiAuthMiddleware, adminGuard, controller.destroy);

export default router;
