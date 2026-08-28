import { QueryTypes, Transaction } from 'sequelize';
import { ShoppingCart, CartStatus } from '../../domain/entities/ShoppingCart';
import { Product } from '../../domain/entities/Product';
import { ShoppingCartRepositoryPort } from '../../domain/ports/ShoppingCartRepositoryPort';
import { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import db, { ShoppingCartInstance, ProductInstance } from '../../database/models/db';

// Raw column names matching `database/models/ShoppingCart.js`'s field mappings,
// following `SequelizeProductRepository`'s `PRODUCT_TABLE` quoting convention.
const CART_TABLE = '`ShoppingCart`';
const CART_ID_COLUMN = '`id_cart`';
const CART_USER_COLUMN = '`id_user`';
const CART_STATUS_COLUMN = '`cart_status`';

export class SequelizeShoppingCartRepository implements ShoppingCartRepositoryPort {
  private toProductEntity(instance: ProductInstance): Product {
    return new Product(
      instance.idProduct,
      instance.nameProduct,
      Number(instance.price),
      instance.descriptionProduct,
      instance.image,
      instance.idCategory,
      instance.idFranchise
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

  // Two separate queries, per design.md's explicit rejection of `include`:
  // Sequelize applies `FOR UPDATE` across joined tables when `lock` is
  // combined with `include`, which would lock `Product` rows as an
  // unintended side effect. (1) locks only `ShoppingCart` rows; (2) a
  // second, non-locking read sources product names/stock, merged in JS.
  async findActiveForUpdate(userId: number, tx: TransactionContext): Promise<ShoppingCart[]> {
    const transaction = tx as unknown as Transaction;

    const cartInstances = await db.ShoppingCart.findAll({
      where: { idUser: userId, cartStatus: 'ACTIVE' },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });

    if (cartInstances.length === 0) {
      return [];
    }

    const productIds = [...new Set(cartInstances.map((row) => row.idProduct))];
    const productInstances = await db.Product.findAll({
      where: { idProduct: productIds },
      transaction,
    });
    const productsById = new Map(productInstances.map((p) => [p.idProduct, p]));

    return cartInstances.map((row) => {
      const productInstance = productsById.get(row.idProduct);
      const product = productInstance ? this.toProductEntity(productInstance) : undefined;
      return new ShoppingCart(row.idCart, row.idUser, row.idProduct, row.quantity, Number(row.unitPrice), row.cartStatus as CartStatus, product);
    });
  }

  // Pure UPDATE — per design.md, "never by deleting and recreating rows".
  // Scoped to idUser AND cartStatus='ACTIVE' so a stale/expired lock window
  // can never flip a row that isn't the one that was actually locked.
  async markOrdered(userId: number, cartIds: number[], tx: TransactionContext): Promise<number> {
    if (cartIds.length === 0) {
      return 0;
    }

    const transaction = tx as unknown as Transaction;
    const [, affectedRows] = await db.sequelize.query(
      `UPDATE ${CART_TABLE} SET ${CART_STATUS_COLUMN} = 'ORDERED' ` +
        `WHERE ${CART_ID_COLUMN} IN (:cartIds) AND ${CART_USER_COLUMN} = :userId AND ${CART_STATUS_COLUMN} = 'ACTIVE'`,
      {
        replacements: { cartIds, userId },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );

    return affectedRows as number;
  }
}
