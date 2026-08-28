import { ShoppingCart } from '../entities/ShoppingCart';
import { TransactionContext } from './UnitOfWorkPort';

export interface ShoppingCartRepositoryPort {
  findByUserId(userId: number): Promise<ShoppingCart[]>;
  getDistinctCount(userId: number): Promise<number>;
  syncCart(userId: number, items: { productId: number; quantity: number; unitPrice: number }[]): Promise<void>;
  // Additive; `syncCart`'s destroy+recreate semantics are NOT reused for checkout.
  findActiveForUpdate(userId: number, tx: TransactionContext): Promise<ShoppingCart[]>;
  markOrdered(userId: number, cartIds: number[], tx: TransactionContext): Promise<number>;
}
