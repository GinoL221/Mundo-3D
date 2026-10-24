import { Router } from 'express';
import { ListCustomCommissionRequestsUseCase } from '../../../application/use-cases/ListCustomCommissionRequestsUseCase';
import { Role } from '../../../domain/Role';
import { CustomCommissionRequestApiController } from '../../controllers/CustomCommissionRequestApiController';
import { apiAuthMiddleware, requireRoles } from '../../middlewares/auth';
import { SequelizeCustomCommissionRequestRepository } from '../../repositories/SequelizeCustomCommissionRequestRepository';

const router = Router();
const repository = new SequelizeCustomCommissionRequestRepository();
const controller = new CustomCommissionRequestApiController(
  new ListCustomCommissionRequestsUseCase(repository),
);

/**
 * @openapi
 * /custom-commission-requests:
 *   get:
 *     summary: List unexpired custom commission requests
 *     tags: [Custom commission requests]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       '200':
 *         description: Newest unexpired requests; response is not cacheable.
 *         headers:
 *           Cache-Control:
 *             schema: { type: string, enum: [no-store] }
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/CustomCommissionRequest' } }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN or STAFF. }
 */
router.get('/', apiAuthMiddleware, requireRoles(Role.ADMIN, Role.STAFF), controller.list);

export default router;
