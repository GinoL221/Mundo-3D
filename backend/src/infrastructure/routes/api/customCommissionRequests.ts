import { NextFunction, Request, Response, Router } from 'express';
import { validationResult } from 'express-validator';
import { CreateCustomCommissionRequestUseCase } from '../../../application/use-cases/CreateCustomCommissionRequestUseCase';
import { ListCustomCommissionRequestsUseCase } from '../../../application/use-cases/ListCustomCommissionRequestsUseCase';
import { SequelizeCustomCommissionRequestRepository } from '../../repositories/SequelizeCustomCommissionRequestRepository';
import { SequelizeProductRepository } from '../../repositories/SequelizeProductRepository';
import { CustomCommissionRequestApiController } from '../../controllers/CustomCommissionRequestApiController';
import { apiAuthMiddleware, requireRoles } from '../../middlewares/auth';
import { Role } from '../../../domain/Role';
import { customCommissionRequestValidators } from '../../middlewares/validators/customCommissionRequestValidators';
import customCommissionRequestLimiter from '../../middlewares/customCommissionRequestLimiter';

const router = Router();

const handleCommissionValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array().map(({ msg }) => ({ msg })) });
    return;
  }
  next();
};
const requests = new SequelizeCustomCommissionRequestRepository();
const products = new SequelizeProductRepository();
const controller = new CustomCommissionRequestApiController(
  new CreateCustomCommissionRequestUseCase(requests, products),
  new ListCustomCommissionRequestsUseCase(requests),
);

/**
 * @openapi
 * /custom-commission-requests:
 *   post:
 *     summary: Submit a custom commission request
 *     tags: [Custom commission requests]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CustomCommissionRequestInput' }
 *     responses:
 *       '201':
 *         description: Request accepted; response contains receipt metadata only.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CustomCommissionRequestReceipt' }
 *       '400': { description: Invalid input or selected product does not exist. }
 *       '429': { description: Per-IP request limit exceeded. }
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
router.post('/', customCommissionRequestLimiter, customCommissionRequestValidators, handleCommissionValidationErrors, controller.create);
router.get('/', apiAuthMiddleware, requireRoles(Role.ADMIN, Role.STAFF), controller.list);

export default router;
