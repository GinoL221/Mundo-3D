import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { ProductDTO } from '../dtos/ProductDTO';

export class AdjustProductStockUseCase {
  constructor(
    private readonly productRepo: ProductRepositoryPort,
    private readonly logger: LoggerPort
  ) {}

  // Delegates the atomic delta math and invariant enforcement entirely to
  // `ProductRepositoryPort.adjustStock` (implemented as a single conditional SQL
  // UPDATE — see SequelizeProductRepository). That method already:
  //   - throws `Error('Delta must be a non-zero integer')` for a zero or
  //     non-integer delta (mapped by the controller to HTTP 400),
  //   - throws `Error('Insufficient stock')` when the delta would push stock
  //     below zero (mapped by the controller to HTTP 409),
  //   - resolves `null` when the product does not exist (mapped by the
  //     controller to HTTP 404).
  // This use case does not re-validate or re-map those errors — it forwards
  // them unchanged so there is a single source of truth for the invariant.
  //
  // Every attempt is audit-logged (product id, delta, outcome, timestamp).
  // This is a partial mitigation for the lack of adjustment idempotency
  // (tracked separately as tech debt): it does not prevent a double-applied
  // delta, but it makes one detectable/traceable after the fact via logs.
  async execute(id: number, delta: number): Promise<ProductDTO | null> {
    let updated;
    try {
      updated = await this.productRepo.adjustStock(id, delta);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        {
          event: 'stock_adjustment',
          productId: id,
          delta,
          outcome: 'rejected',
          reason,
          timestamp: new Date().toISOString(),
        },
        `Stock adjustment rejected for product ${id}: ${reason}`
      );
      throw error;
    }

    if (!updated) {
      this.logger.warn(
        {
          event: 'stock_adjustment',
          productId: id,
          delta,
          outcome: 'rejected',
          reason: 'not_found',
          timestamp: new Date().toISOString(),
        },
        `Stock adjustment rejected for product ${id}: product not found`
      );
      return null;
    }

    this.logger.info(
      {
        event: 'stock_adjustment',
        productId: id,
        delta,
        outcome: 'success',
        resultingStock: updated.Stock,
        timestamp: new Date().toISOString(),
      },
      `Stock adjustment succeeded for product ${id}`
    );

    const categoryName = updated.Category ? updated.Category.nameCategory : 'Sin categoría';

    return {
      idProduct: updated.idProduct,
      nameProduct: updated.nameProduct,
      price: Number(updated.price),
      descriptionProduct: updated.descriptionProduct,
      image: updated.image,
      idCategory: updated.idCategory,
      idFranchise: updated.idFranchise,
      category: categoryName,
      material: updated.Material,
      height: updated.Height,
      width: updated.Width,
      depth: updated.Depth,
      finish: updated.Finish,
      productionTime: updated.ProductionTime,
      stock: updated.Stock ?? 0,
    };
  }
}
