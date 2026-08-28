import { Order } from '../../domain/entities/Order';

export interface OrderItemDTO {
  idOrderItem: number;
  idProduct: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderDTO {
  idOrder: number;
  idUser: number;
  status: string;
  items: OrderItemDTO[];
  totalAmount: number;
  createdAt: string;
  paymentReference: string | null;
}

// `idempotencyKey` is deliberately absent — it is a client-supplied dedup
// token, not buyer-facing data (order-checkout spec).
export function mapToOrderDTO(order: Order): OrderDTO {
  return {
    idOrder: order.idOrder,
    idUser: order.idUser,
    status: order.status,
    items: order.items.map((item) => ({
      idOrderItem: item.idOrderItem,
      idProduct: item.idProduct,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    })),
    totalAmount: order.totalAmount,
    createdAt: order.createdAt.toISOString(),
    paymentReference: order.paymentReference,
  };
}
