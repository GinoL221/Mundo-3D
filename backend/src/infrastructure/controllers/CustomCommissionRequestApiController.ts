import { NextFunction, Request, Response } from 'express';
import { ListCustomCommissionRequestsUseCase } from '../../application/use-cases/ListCustomCommissionRequestsUseCase';

export class CustomCommissionRequestApiController {
  constructor(private readonly listUseCase: ListCustomCommissionRequestsUseCase) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await this.listUseCase.execute());
    } catch (error) {
      next(error);
    }
  };
}
