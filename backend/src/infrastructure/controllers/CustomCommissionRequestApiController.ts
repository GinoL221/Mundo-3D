import { NextFunction, Request, Response } from 'express';
import { CreateCustomCommissionRequestUseCase } from '../../application/use-cases/CreateCustomCommissionRequestUseCase';
import { ListCustomCommissionRequestsUseCase } from '../../application/use-cases/ListCustomCommissionRequestsUseCase';
import { ListMyCustomCommissionRequestsUseCase } from '../../application/use-cases/ListMyCustomCommissionRequestsUseCase';
import { SelectedProductNotFoundException } from '../../domain/exceptions/SelectedProductNotFoundException';
import { Role } from '../../domain/Role';
import { logger } from '../logging/logger';

export class CustomCommissionRequestApiController {
  constructor(
    private readonly createUseCase: CreateCustomCommissionRequestUseCase,
    private readonly listUseCase: ListCustomCommissionRequestsUseCase,
    private readonly listMineUseCase?: ListMyCustomCommissionRequestsUseCase,
  ) {}

  create = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const principalRole = req.user?.idRole ?? req.user?.role;
      const principalUserId = req.user?.userId;
      const idUser =
        principalRole === Role.USER &&
        typeof principalUserId === 'number' &&
        Number.isSafeInteger(principalUserId) &&
        principalUserId > 0
          ? principalUserId
          : null;
      const created = await this.createUseCase.execute({
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone ?? null,
        idea: req.body.idea,
        idProduct: req.body.idProduct,
        idUser,
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

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (
        typeof userId !== 'number' ||
        !Number.isSafeInteger(userId) ||
        userId <= 0 ||
        !this.listMineUseCase
      ) {
        res.status(401).json({ error: 'Autenticación requerida' });
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json(await this.listMineUseCase.execute(userId));
    } catch (error) {
      next(error);
    }
  };
}
