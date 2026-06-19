import { Request, Response, NextFunction } from 'express';
import { SequelizeShoppingCartRepository } from '../repositories/SequelizeShoppingCartRepository';
import { GetCartDistinctCountUseCase } from '../../application/use-cases/GetCartDistinctCountUseCase';

const cartRepo = new SequelizeShoppingCartRepository();
const getCartDistinctCountUseCase = new GetCartDistinctCountUseCase(cartRepo);

export const cartCountMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  res.locals.cartDistinctCount = 0;

  if (res.locals.isLogged && res.locals.userLogged) {
    try {
      const userId = res.locals.userLogged.idUser;
      const count = await getCartDistinctCountUseCase.execute(userId);
      res.locals.cartDistinctCount = count;
    } catch (error: any) {
      console.error('Error computing cart count:', error.message);
    }
  }

  next();
};

export default cartCountMiddleware;
