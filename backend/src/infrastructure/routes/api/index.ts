import { Router } from 'express';
import productsApiRouter from './products';
import usersApiRouter from './users';
import cartApiRouter from './cart';
import categoriesApiRouter from './categories';

const router = Router();

router.use(productsApiRouter);
router.use(usersApiRouter);
router.use(cartApiRouter);
router.use(categoriesApiRouter);

export default router;
