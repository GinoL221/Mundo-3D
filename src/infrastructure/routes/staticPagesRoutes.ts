import { Router } from 'express';

import { SequelizeProductRepository } from '../repositories/SequelizeProductRepository';
import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase';
import { StaticPagesController } from '../controllers/StaticPagesController';

const router = Router();

// Setup dependency injection
const productRepo = new SequelizeProductRepository();
const listProductsUseCase = new ListProductsUseCase(productRepo);

const controller = new StaticPagesController(listProductsUseCase);

router.get('/', controller.home);
router.get('/aboutUs', controller.aboutUs);
router.get('/terms', controller.terms);
router.get('/privacy', controller.privacy);
router.get('/faq', controller.faq);
router.get('/step-by-step', controller.stepByStep);
router.get('/help', controller.help);

export default router;
