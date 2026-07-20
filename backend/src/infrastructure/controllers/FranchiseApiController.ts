import { NextFunction, Request, Response } from 'express';
import { ListFranchisesUseCase } from '../../application/use-cases/ListFranchisesUseCase';
import { GetFranchiseByIdUseCase } from '../../application/use-cases/GetFranchiseByIdUseCase';
import { CreateFranchiseUseCase } from '../../application/use-cases/CreateFranchiseUseCase';
import { UpdateFranchiseUseCase } from '../../application/use-cases/UpdateFranchiseUseCase';
import { DeleteFranchiseUseCase } from '../../application/use-cases/DeleteFranchiseUseCase';

const DUPLICATE_FRANCHISE_NAME = 'DUPLICATE_FRANCHISE_NAME';

const parseFranchiseId = (value: string): number | null =>
  /^\d+$/.test(value) ? Number(value) : null;

export class FranchiseApiController {
  constructor(
    private readonly listFranchisesUseCase: ListFranchisesUseCase,
    private readonly getFranchiseByIdUseCase: GetFranchiseByIdUseCase,
    private readonly createFranchiseUseCase: CreateFranchiseUseCase,
    private readonly updateFranchiseUseCase: UpdateFranchiseUseCase,
    private readonly deleteFranchiseUseCase: DeleteFranchiseUseCase,
  ) {}

  index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.listFranchisesUseCase.execute());
    } catch (error) {
      next(error);
    }
  };

  show = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseFranchiseId(req.params.id as string);
      if (id === null) {
        res.status(400).json({ error: 'Id de franquicia inválido' });
        return;
      }
      res.json(await this.getFranchiseByIdUseCase.execute(id));
    } catch (error) {
      if (error instanceof Error && error.message === 'Franchise not found') {
        res.status(404).json({ error: 'Franquicia no encontrada' });
        return;
      }
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const franchise = await this.createFranchiseUseCase.execute({
        nameFranchise: req.body.nameFranchise,
      });
      res.status(201).json(franchise);
    } catch (error) {
      if (error instanceof Error && error.message === DUPLICATE_FRANCHISE_NAME) {
        res.status(409).json({ error: DUPLICATE_FRANCHISE_NAME });
        return;
      }
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseFranchiseId(req.params.id as string);
      if (id === null) {
        res.status(400).json({ error: 'Id de franquicia inválido' });
        return;
      }
      const franchise = await this.updateFranchiseUseCase.execute(id, {
        nameFranchise: req.body.nameFranchise,
      });
      if (!franchise) {
        res.status(404).json({ error: 'Franquicia no encontrada' });
        return;
      }
      res.json(franchise);
    } catch (error) {
      if (error instanceof Error && error.message === DUPLICATE_FRANCHISE_NAME) {
        res.status(409).json({ error: DUPLICATE_FRANCHISE_NAME });
        return;
      }
      next(error);
    }
  };

  destroy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseFranchiseId(req.params.id as string);
      if (id === null) {
        res.status(400).json({ error: 'Id de franquicia inválido' });
        return;
      }
      if (!(await this.deleteFranchiseUseCase.execute(id))) {
        res.status(404).json({ error: 'Franquicia no encontrada' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'Franchise has associated products') {
        res
          .status(409)
          .json({ error: 'No se puede eliminar la franquicia porque tiene productos asociados' });
        return;
      }
      next(error);
    }
  };
}
