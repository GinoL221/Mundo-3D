import { Router } from 'express';
import productsApiRouter from './products';
import usersApiRouter from './users';
import cartApiRouter from './cart';
import categoriesApiRouter from './categories';
import franchisesApiRouter from './franchises';

const router = Router();

router.use(productsApiRouter);
router.use(usersApiRouter);
router.use(cartApiRouter);
router.use(categoriesApiRouter);
router.use(franchisesApiRouter);

export default router;
