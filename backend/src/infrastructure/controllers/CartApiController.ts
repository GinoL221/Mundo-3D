import { Request, Response, NextFunction } from 'express';
import { GetCartByUserIdUseCase } from '../../application/use-cases/GetCartByUserIdUseCase';
import { SyncCartUseCase } from '../../application/use-cases/SyncCartUseCase';

interface CartSyncItem {
  productId: number;
  quantity: number;
}

export class CartApiController {
  constructor(
    private readonly getCartByUserIdUseCase: GetCartByUserIdUseCase,
    private readonly syncCartUseCase: SyncCartUseCase
  ) {}

  getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const cartDto = await this.getCartByUserIdUseCase.execute(userId);
      res.json(cartDto);
    } catch (error) {
      next(error);
    }
  };

  syncCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const items = (req.body.items || []) as CartSyncItem[];
      await this.syncCartUseCase.execute(userId, items);

      const cartDto = await this.getCartByUserIdUseCase.execute(userId);
      res.json({
        success: true,
        cart: cartDto,
      });
    } catch (error) {
      next(error);
    }
  };
}
