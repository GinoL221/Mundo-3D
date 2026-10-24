import { NextFunction, Request, Response } from 'express';
import { CreateCustomCommissionRequestUseCase } from '../../application/use-cases/CreateCustomCommissionRequestUseCase';
import { ListCustomCommissionRequestsUseCase } from '../../application/use-cases/ListCustomCommissionRequestsUseCase';
import { SelectedProductNotFoundException } from '../../domain/exceptions/SelectedProductNotFoundException';
import { logger } from '../logging/logger';

export class CustomCommissionRequestApiController {
  constructor(
    private readonly createUseCase: CreateCustomCommissionRequestUseCase,
    private readonly listUseCase: ListCustomCommissionRequestsUseCase,
  ) {}

  create = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const created = await this.createUseCase.execute({
        name: req.body.name,
        email: req.body.email,
        idea: req.body.idea,
        idProduct: req.body.idProduct,
      });
      res.status(201).json({
        idCustomCommissionRequest: created.idCustomCommissionRequest,
        createdAt: created.createdAt,
        expiresAt: created.expiresAt,
      });
    } catch (error) {
      if (error instanceof SelectedProductNotFoundException) {
        res.status(400).json({ error: 'Selected product does not exist' });
        return;
      }

      const errorType = error instanceof Error ? error.name : typeof error;
      logger.error({ errorType }, 'Failed to submit custom commission request');
      res.status(500).json({ error: 'Unable to submit custom commission request' });
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await this.listUseCase.execute());
    } catch (error) {
      next(error);
    }
  };
}
