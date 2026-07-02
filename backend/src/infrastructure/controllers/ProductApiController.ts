import { Request, Response, NextFunction } from 'express';
import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase';
import { GetProductByIdUseCase } from '../../application/use-cases/GetProductByIdUseCase';
import { GetLatestProductUseCase } from '../../application/use-cases/GetLatestProductUseCase';
import { CreateProductUseCase } from '../../application/use-cases/CreateProductUseCase';
import { UpdateProductUseCase } from '../../application/use-cases/UpdateProductUseCase';
import { DeleteProductUseCase } from '../../application/use-cases/DeleteProductUseCase';
import { AdjustProductStockUseCase } from '../../application/use-cases/AdjustProductStockUseCase';
import { cleanupUploadedFile } from '../utils/cleanupUploadedFile';

type RequestWithFile = Request & { file?: { filename: string; path?: string } };

const toOptionalNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return Number(value);
};

export class ProductApiController {
  constructor(
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly getLatestProductUseCase: GetLatestProductUseCase,
    private readonly createProductUseCase?: CreateProductUseCase,
    private readonly updateProductUseCase?: UpdateProductUseCase,
    private readonly deleteProductUseCase?: DeleteProductUseCase,
    private readonly adjustProductStockUseCase?: AdjustProductStockUseCase
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
    } catch (error) {
      if (error instanceof Error && error.message === 'Product not found') {
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
    } catch (error) {
      if (error instanceof Error && error.message === 'Product not found') {
        res.status(404).json({ error: 'No hay productos disponibles.' });
        return;
      }
      next(error);
    }
  };

  create = async (req: RequestWithFile, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.createProductUseCase) {
        throw new Error('CreateProductUseCase not injected');
      }

      const {
        nameProduct,
        price,
        descriptionProduct,
        idCategory,
        idFranchise,
        material,
        height,
        width,
        depth,
        finish,
        productionTime,
        stock,
      } = req.body;

      const product = await this.createProductUseCase.execute({
        nameProduct,
        price: Number(price),
        descriptionProduct: descriptionProduct ?? null,
        image: req.file?.filename ?? null,
        idCategory: Number(idCategory),
        idFranchise: Number(idFranchise),
        material: material ?? null,
        height: toOptionalNumber(height),
        width: toOptionalNumber(width),
        depth: toOptionalNumber(depth),
        finish: finish ?? null,
        productionTime: toOptionalNumber(productionTime) ?? undefined,
        stock: stock !== undefined && stock !== null && stock !== '' ? Number(stock) : undefined,
      });

      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: RequestWithFile, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.updateProductUseCase) {
        throw new Error('UpdateProductUseCase not injected');
      }

      const id = parseInt(req.params.id as string, 10);
      const {
        nameProduct,
        price,
        descriptionProduct,
        idCategory,
        idFranchise,
        material,
        height,
        width,
        depth,
        finish,
        productionTime,
      } = req.body;

      // NOTE: `stock` is intentionally never read from `req.body` here — PUT
      // /api/products/:id MUST NOT modify stock (product-inventory spec,
      // "Product Update"). UpdateProductInput has no `stock` field, so this
      // object cannot carry one even if the request body includes it.
      const input: Record<string, unknown> = {};
      if (nameProduct !== undefined) input.nameProduct = nameProduct;
      if (price !== undefined) input.price = Number(price);
      if (descriptionProduct !== undefined) input.descriptionProduct = descriptionProduct;
      if (req.file?.filename) input.image = req.file.filename;
      if (idCategory !== undefined) input.idCategory = Number(idCategory);
      if (idFranchise !== undefined) input.idFranchise = Number(idFranchise);
      if (material !== undefined) input.material = material;
      if (height !== undefined) input.height = toOptionalNumber(height);
      if (width !== undefined) input.width = toOptionalNumber(width);
      if (depth !== undefined) input.depth = toOptionalNumber(depth);
      if (finish !== undefined) input.finish = finish;
      if (productionTime !== undefined) input.productionTime = toOptionalNumber(productionTime);

      const product = await this.updateProductUseCase.execute(id, input);
      if (!product) {
        // A replacement image may have already been written to disk by
        // multer before the use case discovered the product doesn't exist —
        // don't leave it orphaned.
        if (req.file?.path) {
          cleanupUploadedFile(req.file.path);
        }
        res.status(404).json({ error: 'Producto no encontrado' });
        return;
      }
      res.json(product);
    } catch (error) {
      next(error);
    }
  };

  destroy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.deleteProductUseCase) {
        throw new Error('DeleteProductUseCase not injected');
      }

      const id = parseInt(req.params.id as string, 10);
      const deleted = await this.deleteProductUseCase.execute(id);
      if (!deleted) {
        res.status(404).json({ error: 'Producto no encontrado' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  adjustStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.adjustProductStockUseCase) {
        throw new Error('AdjustProductStockUseCase not injected');
      }

      const id = parseInt(req.params.id as string, 10);
      const delta = Number(req.body?.delta);

      const product = await this.adjustProductStockUseCase.execute(id, delta);
      if (!product) {
        res.status(404).json({ error: 'Producto no encontrado' });
        return;
      }
      res.json(product);
    } catch (error) {
      if (error instanceof Error && error.message === 'Insufficient stock') {
        res.status(409).json({ error: 'Stock insuficiente' });
        return;
      }
      if (error instanceof Error && error.message === 'Delta must be a non-zero integer') {
        res.status(400).json({ error: 'delta debe ser un entero distinto de cero' });
        return;
      }
      next(error);
    }
  };
}
