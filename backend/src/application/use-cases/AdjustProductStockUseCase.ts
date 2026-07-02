import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ProductDTO } from '../dtos/ProductDTO';

export class AdjustProductStockUseCase {
  constructor(private readonly productRepo: IProductRepository) {}

  // Delegates the atomic delta math and invariant enforcement entirely to
  // `IProductRepository.adjustStock` (implemented as a single conditional SQL
  // UPDATE — see SequelizeProductRepository). That method already:
  //   - throws `Error('Delta must be a non-zero integer')` for a zero or
  //     non-integer delta (mapped by the controller to HTTP 400),
  //   - throws `Error('Insufficient stock')` when the delta would push stock
  //     below zero (mapped by the controller to HTTP 409),
  //   - resolves `null` when the product does not exist (mapped by the
  //     controller to HTTP 404).
  // This use case does not re-validate or re-map those errors — it forwards
  // them unchanged so there is a single source of truth for the invariant.
  async execute(id: number, delta: number): Promise<ProductDTO | null> {
    const updated = await this.productRepo.adjustStock(id, delta);
    if (!updated) {
      return null;
    }

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
