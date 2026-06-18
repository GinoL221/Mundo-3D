import { Request, Response, NextFunction } from 'express';
import { GetCartByUserIdUseCase } from '../../application/use-cases/GetCartByUserIdUseCase';

export class CartController {
  constructor(private readonly getCartByUserIdUseCase: GetCartByUserIdUseCase) {}

  async viewCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).session?.userLogged?.IDUser;
      if (!userId) {
        throw new Error('User is not logged in');
      }

      const result = await this.getCartByUserIdUseCase.execute(userId);

      res.render('products/productCart', {
        userShoppingCart: result.items,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
}
