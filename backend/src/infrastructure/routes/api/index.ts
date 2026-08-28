import { Router } from 'express';
import productsApiRouter from './products';
import usersApiRouter from './users';
import cartApiRouter from './cart';
import categoriesApiRouter from './categories';
import franchisesApiRouter from './franchises';
import ordersApiRouter from './orders';

const router = Router();

router.use(productsApiRouter);
router.use(usersApiRouter);
router.use(cartApiRouter);
router.use(categoriesApiRouter);
router.use(franchisesApiRouter);
router.use(ordersApiRouter);

export default router;
