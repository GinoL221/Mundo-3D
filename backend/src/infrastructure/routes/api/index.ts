import { Router } from 'express';
import productsApiRouter from './products';
import usersApiRouter from './users';
import cartApiRouter from './cart';
import categoriesApiRouter from './categories';
import franchisesApiRouter from './franchises';
import ordersApiRouter from './orders';
import { createOpenApiRouteHandler } from '../../openapi/openapiArtifact';

const router = Router();

router.use(productsApiRouter);
router.use(usersApiRouter);
router.use(cartApiRouter);
router.use(categoriesApiRouter);
router.use(franchisesApiRouter);
router.use(ordersApiRouter);

// GET /api/openapi.json — read-only OpenAPI 3.0 contract, no auth required
// (documentation, not data). Serves the committed, build-time-generated
// artifact (see openapiArtifact.ts) instead of rebuilding it per request.
// Deliberately no swagger-ui-express/`/docs` UI — out of scope for this change.
router.get('/openapi.json', createOpenApiRouteHandler());

export default router;
