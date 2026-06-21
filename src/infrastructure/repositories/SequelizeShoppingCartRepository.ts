import { ShoppingCart, CartStatus } from '../../domain/entities/ShoppingCart';
import { Product } from '../../domain/entities/Product';
import { IShoppingCartRepository } from '../../domain/ports/IShoppingCartRepository';
import db, { ShoppingCartInstance } from '../../database/models/db';

export class SequelizeShoppingCartRepository implements IShoppingCartRepository {
  private toEntity(instance: ShoppingCartInstance): ShoppingCart {
    const product = instance.product
      ? new Product(
          instance.product.idProduct,
          instance.product.nameProduct,
          Number(instance.product.price),
          instance.product.descriptionProduct,
          instance.product.image,
          instance.product.idCategory,
          instance.product.idFranchise
        )
      : undefined;

    return new ShoppingCart(
      instance.idCart,
      instance.idUser,
      instance.idProduct,
      instance.quantity,
      Number(instance.unitPrice),
      instance.cartStatus as CartStatus,
      product
    );
  }

  async findByUserId(userId: number): Promise<ShoppingCart[]> {
    const instances = await db.ShoppingCart.findAll({
      where: { idUser: userId },
      include: [{ model: db.Product, as: 'product' }],
    });
    return instances.map((inst) => this.toEntity(inst));
  }

  async getDistinctCount(userId: number): Promise<number> {
    const count = await db.ShoppingCart.count({
      where: {
        idUser: userId,
        cartStatus: 'ACTIVE',
      },
      distinct: true,
      col: 'idProduct',
    });
    return count;
  }

  async syncCart(userId: number, items: { productId: number; quantity: number; unitPrice: number }[]): Promise<void> {
    const transaction = await db.sequelize.transaction();
    try {
      await db.ShoppingCart.destroy({
        where: {
          idUser: userId,
          cartStatus: 'ACTIVE',
        },
        transaction,
      });

      for (const item of items) {
        await db.ShoppingCart.create(
          {
            idUser: userId,
            idProduct: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            cartStatus: 'ACTIVE',
          },
          { transaction }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
