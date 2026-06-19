import { Request, Response, NextFunction } from 'express';
import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase';
import { GetProductByIdUseCase } from '../../application/use-cases/GetProductByIdUseCase';
import { GetLatestProductUseCase } from '../../application/use-cases/GetLatestProductUseCase';

export class ProductApiController {
  constructor(
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly getLatestProductUseCase: GetLatestProductUseCase
  ) {}

  index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listProductsUseCase.execute();
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  show = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const product = await this.getProductByIdUseCase.execute(id);
      res.json(product);
    } catch (error: any) {
      if (error.message === 'Product not found') {
        res.status(404).json({ error: 'Producto no encontrado' });
        return;
      }
      next(error);
    }
  };

  latest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.getLatestProductUseCase.execute();
      res.json(product);
    } catch (error: any) {
      if (error.message === 'Product not found') {
        res.status(404).json({ error: 'No hay productos disponibles.' });
        return;
      }
      next(error);
    }
  };
}
