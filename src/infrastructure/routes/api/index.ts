import { Router } from 'express';
import productsApiRouter from './products';
import usersApiRouter from './users';

const router = Router();

router.use(productsApiRouter);
router.use(usersApiRouter);

export default router;
