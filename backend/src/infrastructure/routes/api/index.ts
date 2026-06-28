import { Router } from 'express';
import productsApiRouter from './products';
import usersApiRouter from './users';
import cartApiRouter from './cart';

const router = Router();

router.use(productsApiRouter);
router.use(usersApiRouter);
router.use(cartApiRouter);

export default router;
