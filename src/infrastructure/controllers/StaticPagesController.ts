import { Request, Response } from 'express';
import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase';

export class StaticPagesController {
  constructor(private readonly listProductsUseCase: ListProductsUseCase) {}

  home = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.listProductsUseCase.execute();
      // Adapt flat ProductDTO.Category to the nested shape index.ejs expects,
      // so the out-of-scope view stays untouched (Decision 2).
      const products = result.products.map((product) => ({
        ...product,
        Category: { NameCategory: product.Category },
      }));
      res.render('index', { products });
    } catch (error) {
      console.error('Error loading homepage:', error);
      res.render('index', { products: [] }); // degrade-to-empty (Decision 1)
    }
  };

  aboutUs = (req: Request, res: Response): void => {
    res.render('aboutUs');
  };

  faq = (req: Request, res: Response): void => {
    res.render('faq');
  };

  help = (req: Request, res: Response): void => {
    res.render('help');
  };

  privacy = (req: Request, res: Response): void => {
    res.render('privacy');
  };

  stepByStep = (req: Request, res: Response): void => {
    res.render('step-by-step');
  };

  terms = (req: Request, res: Response): void => {
    res.render('terms');
  };
}
