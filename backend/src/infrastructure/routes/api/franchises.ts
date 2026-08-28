import { Router } from 'express';
import { ListFranchisesUseCase } from '../../../application/use-cases/ListFranchisesUseCase';
import { GetFranchiseByIdUseCase } from '../../../application/use-cases/GetFranchiseByIdUseCase';
import { CreateFranchiseUseCase } from '../../../application/use-cases/CreateFranchiseUseCase';
import { UpdateFranchiseUseCase } from '../../../application/use-cases/UpdateFranchiseUseCase';
import { DeleteFranchiseUseCase } from '../../../application/use-cases/DeleteFranchiseUseCase';
import { Role } from '../../../domain/Role';
import { FranchiseApiController } from '../../controllers/FranchiseApiController';
import { apiAuthMiddleware, adminGuard, requireRoles } from '../../middlewares/auth';
import { csrfGuard } from '../../middlewares/csrf';
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

/**
 * @openapi
 * /franchises:
 *   get:
 *     summary: List all franchises
 *     tags: [Franchises]
 *     responses:
 *       '200':
 *         description: All franchises.
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/Franchise' } }
 *   post:
 *     summary: Create a franchise (ADMIN/STAFF)
 *     tags: [Franchises]
 *     security: [{ cookieAuth: [], csrfHeader: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { nameFranchise: { type: string, description: Required, trimmed, non-empty. } }
 *             required: [nameFranchise]
 *     responses:
 *       '201':
 *         description: Franchise created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Franchise' }
 *       '400': { description: Validation error (missing/blank nameFranchise). }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN/STAFF. }
 *       '409': { description: DUPLICATE_FRANCHISE_NAME. }
 * /franchises/{id}:
 *   get:
 *     summary: Get one franchise by id
 *     tags: [Franchises]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The franchise.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Franchise' }
 *       '400': { description: Non-numeric id. }
 *       '404': { description: Franchise not found. }
 *   put:
 *     summary: Update a franchise (ADMIN/STAFF)
 *     tags: [Franchises]
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
 *             properties: { nameFranchise: { type: string, description: Required, trimmed, non-empty. } }
 *             required: [nameFranchise]
 *     responses:
 *       '200':
 *         description: Updated franchise.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Franchise' }
 *       '400': { description: Non-numeric id or validation error. }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN/STAFF. }
 *       '404': { description: Franchise not found. }
 *       '409': { description: DUPLICATE_FRANCHISE_NAME. }
 *   delete:
 *     summary: Delete a franchise (ADMIN only)
 *     tags: [Franchises]
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
 *       '404': { description: Franchise not found. }
 *       '409': { description: Franchise has associated products. }
 */
router.get('/franchises', controller.index);
router.get('/franchises/:id', controller.show);
router.post(
  '/franchises',
  apiAuthMiddleware,
  csrfGuard,
  requireRoles(Role.ADMIN, Role.STAFF),
  franchiseCreateValidators,
  handleValidationErrors,
  controller.create,
);
router.put(
  '/franchises/:id',
  apiAuthMiddleware,
  csrfGuard,
  requireRoles(Role.ADMIN, Role.STAFF),
  franchiseUpdateValidators,
  handleValidationErrors,
  controller.update,
);
router.delete('/franchises/:id', apiAuthMiddleware, csrfGuard, adminGuard, controller.destroy);

export default router;
