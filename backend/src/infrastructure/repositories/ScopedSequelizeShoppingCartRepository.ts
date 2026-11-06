import { QueryTypes, Transaction } from 'sequelize';
import { ShoppingCart, CartStatus } from '../../domain/entities/ShoppingCart';
import { Product } from '../../domain/entities/Product';
import type { ShoppingCartRepositoryPort } from '../../domain/ports/ShoppingCartRepositoryPort';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import type { ShoppingCartInstance, ProductInstance } from '../../database/models/db';
import { resolveScopedTransaction } from '../persistence/scopedTransactionContext';

// Raw column names match the `ShoppingCart.js` field mappings.
const CART_TABLE = '`ShoppingCart`';
const CART_ID_COLUMN = '`id_cart`';
const CART_USER_COLUMN = '`id_user`';
const CART_STATUS_COLUMN = '`cart_status`';

export type ShoppingCartPersistence = Pick<
  typeof import('../../database/models/db'),
  'ShoppingCart' | 'Product' | 'sequelize'
>;

export class ScopedSequelizeShoppingCartRepository implements ShoppingCartRepositoryPort {
  constructor(private readonly db: ShoppingCartPersistence) {}

  private requiredTransaction(context: TransactionContext): Transaction {
    const transaction = resolveScopedTransaction(context, this.db.sequelize);
    if (!transaction) throw new Error('Transaction context is not active for this connection');
    return transaction;
  }

  private toProductEntity(instance: ProductInstance): Product {
    return new Product(
      instance.idProduct,
      instance.nameProduct,
      Number(instance.price),
      instance.descriptionProduct,
      instance.image,
      instance.idCategory,
      instance.idFranchise,
    );
  }

  private toEntity(instance: ShoppingCartInstance): ShoppingCart {
    const product = instance.product ? this.toProductEntity(instance.product) : undefined;

    return new ShoppingCart(
      instance.idCart,
      instance.idUser,
      instance.idProduct,
      instance.quantity,
      Number(instance.unitPrice),
      instance.cartStatus as CartStatus,
      product,
    );
  }

  async findByUserId(userId: number): Promise<ShoppingCart[]> {
    const instances = await this.db.ShoppingCart.findAll({
      where: { idUser: userId },
      include: [{ model: this.db.Product, as: 'product' }],
    });
    return instances.map((instance) => this.toEntity(instance));
  }

  async getDistinctCount(userId: number): Promise<number> {
    return this.db.ShoppingCart.count({
      where: {
        idUser: userId,
        cartStatus: 'ACTIVE',
      },
      distinct: true,
      col: 'idProduct',
    });
  }

  async syncCart(
    userId: number,
    items: { productId: number; quantity: number; unitPrice: number }[],
  ): Promise<void> {
    const transaction = await this.db.sequelize.transaction();
    try {
      await this.db.ShoppingCart.destroy({
        where: {
          idUser: userId,
          cartStatus: 'ACTIVE',
        },
        transaction,
      });

      for (const item of items) {
        await this.db.ShoppingCart.create(
          {
            idUser: userId,
            idProduct: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            cartStatus: 'ACTIVE',
          },
          { transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Keep the lock limited to ShoppingCart rows, then read Product details separately.
  async findActiveForUpdate(userId: number, context: TransactionContext): Promise<ShoppingCart[]> {
    const transaction = this.requiredTransaction(context);
    const cartInstances = await this.db.ShoppingCart.findAll({
      where: { idUser: userId, cartStatus: 'ACTIVE' },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });

    if (cartInstances.length === 0) {
      return [];
    }

    const productIds = [...new Set(cartInstances.map((row) => row.idProduct))];
    const productInstances = await this.db.Product.findAll({
      where: { idProduct: productIds },
      transaction,
    });
    const productsById = new Map(productInstances.map((product) => [product.idProduct, product]));

    return cartInstances.map((row) => {
      const productInstance = productsById.get(row.idProduct);
      const product = productInstance ? this.toProductEntity(productInstance) : undefined;
      return new ShoppingCart(
        row.idCart,
        row.idUser,
        row.idProduct,
        row.quantity,
        Number(row.unitPrice),
        row.cartStatus as CartStatus,
        product,
      );
    });
  }

  async markOrdered(
    userId: number,
    cartIds: number[],
    context: TransactionContext,
  ): Promise<number> {
    if (cartIds.length === 0) {
      return 0;
    }

    const transaction = this.requiredTransaction(context);
    const [, affectedRows] = await this.db.sequelize.query(
      `UPDATE ${CART_TABLE} SET ${CART_STATUS_COLUMN} = 'ORDERED' ` +
        `WHERE ${CART_ID_COLUMN} IN (:cartIds) AND ${CART_USER_COLUMN} = :userId AND ${CART_STATUS_COLUMN} = 'ACTIVE'`,
      {
        replacements: { cartIds, userId },
        type: QueryTypes.UPDATE,
        transaction,
      },
    );

    return affectedRows as number;
  }
}
