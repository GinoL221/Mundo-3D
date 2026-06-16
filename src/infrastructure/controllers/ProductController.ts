import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import path from 'path';
import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase';
import { GetProductByIdUseCase } from '../../application/use-cases/GetProductByIdUseCase';
import { CreateProductUseCase } from '../../application/use-cases/CreateProductUseCase';
import { UpdateProductUseCase } from '../../application/use-cases/UpdateProductUseCase';
import { DeleteProductUseCase } from '../../application/use-cases/DeleteProductUseCase';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import { IFranchiseRepository } from '../../domain/ports/IFranchiseRepository';

export class ProductController {
  constructor(
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase,
    private readonly categoryRepo: ICategoryRepository,
    private readonly franchiseRepo: IFranchiseRepository
  ) {}

  getAllProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listProductsUseCase.execute();
      res.render('products/products', { allProducts: result.products });
    } catch (error) {
      console.error('Error al obtener todos los productos:', error);
      next(error);
    }
  };

  getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string);
      const product = await this.getProductByIdUseCase.execute(id);
      res.render(path.join(__dirname, '../../views/products/productDetail.ejs'), { product });
    } catch (error: any) {
      if (error.message === 'Product not found') {
        return res.render(path.join(__dirname, '../../views/404NotFound.ejs'), {
          message: 'Product not found',
        });
      }
      console.error('Error al obtener detalles del producto:', error);
      next(error);
    }
  };

  formNewProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await this.categoryRepo.findAll();
      const franchises = await this.franchiseRepo.findAll();
      res.render(path.join(__dirname, '../../views/products/newProduct.ejs'), { categories, franchises });
    } catch (error) {
      console.error('Error al mostrar el formulario de creación:', error);
      next(error);
    }
  };

  postNewProduct = async (req: Request & { file?: { filename: string } }, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    try {
      const categories = await this.categoryRepo.findAll();
      const franchises = await this.franchiseRepo.findAll();

      if (errors.isEmpty()) {
        const { productName, price, description, category, franchise } = req.body;
        const image = req.file?.filename || null;

        if (!category || !franchise) {
          res.status(400).json({ error: 'Category y Franchise son obligatorios' });
          return;
        }

        await this.createProductUseCase.execute({
          NameProduct: productName,
          Price: parseFloat(price),
          DescriptionProduct: description || null,
          Image: image,
          IDCategory: parseInt(category),
          IDFranchise: parseInt(franchise),
        });

        res.redirect('/products');
      } else {
        res.render('products/newProduct', {
          categories,
          franchises,
          errors: errors.mapped(),
          oldData: req.body,
        });
      }
    } catch (error) {
      console.error('Error al crear el producto:', error);
      next(error);
    }
  };

  confirmModifyProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string);
      const updated = await this.updateProductUseCase.execute(id, {
        NameProduct: req.body.productName,
        Price: req.body.price ? parseFloat(req.body.price) : undefined,
        DescriptionProduct: req.body.description,
      });

      if (!updated) {
        return res.render(path.join(__dirname, '../../views/404NotFound.ejs'), { message: 'Product not found' });
      }

      res.redirect('/products');
    } catch (error) {
      console.error('Error al modificar el producto:', error);
      next(error);
    }
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string);
      const deleted = await this.deleteProductUseCase.execute(id);

      if (!deleted) {
        res.status(404).send('Producto no encontrado');
        return;
      }

      res.redirect('/products');
    } catch (error) {
      console.error('Error al eliminar el producto:', error);
      next(error);
    }
  };
}
