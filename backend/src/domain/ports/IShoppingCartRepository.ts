import { ShoppingCart } from '../entities/ShoppingCart';

export interface IShoppingCartRepository {
  findByUserId(userId: number): Promise<ShoppingCart[]>;
  getDistinctCount(userId: number): Promise<number>;
  syncCart(userId: number, items: { productId: number; quantity: number; unitPrice: number }[]): Promise<void>;
}
