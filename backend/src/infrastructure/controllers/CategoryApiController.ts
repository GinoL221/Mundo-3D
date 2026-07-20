import { Request, Response, NextFunction } from 'express';
import { ListCategoriesUseCase } from '../../application/use-cases/ListCategoriesUseCase';
import { GetCategoryByIdUseCase } from '../../application/use-cases/GetCategoryByIdUseCase';
import { CreateCategoryUseCase } from '../../application/use-cases/CreateCategoryUseCase';
import { UpdateCategoryUseCase } from '../../application/use-cases/UpdateCategoryUseCase';
import { DeleteCategoryUseCase } from '../../application/use-cases/DeleteCategoryUseCase';

export class CategoryApiController {
  constructor(
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
    private readonly getCategoryByIdUseCase: GetCategoryByIdUseCase,
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly deleteCategoryUseCase: DeleteCategoryUseCase
  ) {}

  index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listCategoriesUseCase.execute();
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  show = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Id de categoría inválido' });
        return;
      }
      const category = await this.getCategoryByIdUseCase.execute(id);
      res.json(category);
    } catch (error) {
      if (error instanceof Error && error.message === 'Category not found') {
        res.status(404).json({ error: 'Categoría no encontrada' });
        return;
      }
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { nameCategory } = req.body;
      const category = await this.createCategoryUseCase.execute({ nameCategory });
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Id de categoría inválido' });
        return;
      }

      const { nameCategory } = req.body;
      const input = { nameCategory };

      const category = await this.updateCategoryUseCase.execute(id, input);
      if (!category) {
        res.status(404).json({ error: 'Categoría no encontrada' });
        return;
      }
      res.json(category);
    } catch (error) {
      next(error);
    }
  };

  destroy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Id de categoría inválido' });
        return;
      }
      const deleted = await this.deleteCategoryUseCase.execute(id);
      if (!deleted) {
        res.status(404).json({ error: 'Categoría no encontrada' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'Category has associated products') {
        res.status(409).json({ error: 'No se puede eliminar la categoría porque tiene productos asociados' });
        return;
      }
      next(error);
    }
  };
}
