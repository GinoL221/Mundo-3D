import { Order, OrderStatus } from '../entities/Order';
import { TransactionContext } from './UnitOfWorkPort';

export interface NewOrderItemInput {
  idProduct: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderRepositoryPort {
  createWithItems(
    input: { idUser: number; idempotencyKey: string; items: NewOrderItemInput[] },
    tx: TransactionContext
  ): Promise<Order>; // throws DuplicateIdempotencyKeyException
  findByIdempotencyKey(idUser: number, idempotencyKey: string): Promise<Order | null>;
  findById(idOrder: number): Promise<Order | null>;
  findAll(): Promise<Order[]>;
  transitionStatus(
    idOrder: number,
    from: OrderStatus,
    to: OrderStatus,
    tx?: TransactionContext
  ): Promise<boolean>; // true iff exactly 1 row changed
  attachPaymentReference(idOrder: number, reference: string): Promise<void>;
}
