import { ShoppingCart, CartStatus } from '../../domain/entities/ShoppingCart';
import { Product } from '../../domain/entities/Product';
import { IShoppingCartRepository } from '../../domain/ports/IShoppingCartRepository';
import db, { ShoppingCartInstance } from '../../database/models/db';

export class SequelizeShoppingCartRepository implements IShoppingCartRepository {
  private toEntity(instance: ShoppingCartInstance): ShoppingCart {
    const product = instance.product
      ? new Product(
          instance.product.IDProduct,
          instance.product.NameProduct,
          Number(instance.product.Price),
          instance.product.DescriptionProduct,
          instance.product.Image,
          instance.product.IDCategory,
          instance.product.IDFranchise
        )
      : undefined;

    return new ShoppingCart(
      instance.IDCart,
      instance.IDUser,
      instance.IDProduct,
      instance.Quantity,
      Number(instance.UnitPrice),
      instance.CartStatus as CartStatus,
      product
    );
  }

  async findByUserId(userId: number): Promise<ShoppingCart[]> {
    const instances = await db.ShoppingCart.findAll({
      where: { IDUser: userId },
      include: [{ model: db.Product, as: 'product' }],
    });
    return instances.map((inst) => this.toEntity(inst));
  }

  async getDistinctCount(userId: number): Promise<number> {
    const count = await db.ShoppingCart.count({
      where: {
        IDUser: userId,
        CartStatus: 'ACTIVE',
      },
      distinct: true,
      col: 'IDProduct',
    });
    return count;
  }
}
