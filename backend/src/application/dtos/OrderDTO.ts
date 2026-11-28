import { Order } from '../../domain/entities/Order';
import type { User } from '../../domain/entities/User';

export interface OrderItemDTO {
  idOrderItem: number;
  idProduct: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// Scalar subset shared by both the ADMIN/buyer detail view (`OrderDTO`) and
// the buyer order-history listing (order-history spec's "Order Summary
// Representation") — no line items, so a paginated listing response stays
// cheap regardless of how many items each order has.
export interface OrderSummaryDTO {
  idOrder: number;
  idUser: number;
  status: string;
  totalAmount: number;
  createdAt: string;
  paymentReference: string | null;
}

export interface OrderDTO extends OrderSummaryDTO {
  items: OrderItemDTO[];
}

export interface OrderCustomerDTO {
  idUser: number;
  displayName: string;
}

export interface WorkshopOrderDTO extends OrderDTO {
  customer: OrderCustomerDTO;
}

export function toCustomerDisplayName(user: Pick<User, 'firstName' | 'lastName'> | null): string {
  if (!user) return 'Cliente eliminado';
  const first = user.firstName.trim();
  const initial = user.lastName.trim().charAt(0).toUpperCase();
  if (!first) return 'Cliente';
  return initial ? `${first} ${initial}.` : first;
}

// `idempotencyKey` is deliberately absent — it is a client-supplied dedup
// token, not buyer-facing data (order-checkout spec).
export function mapToOrderSummaryDTO(order: Order): OrderSummaryDTO {
  return {
    idOrder: order.idOrder,
    idUser: order.idUser,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt.toISOString(),
    paymentReference: order.paymentReference,
  };
}

export function mapToOrderDTO(order: Order): OrderDTO {
  return {
    ...mapToOrderSummaryDTO(order),
    items: order.items.map((item) => ({
      idOrderItem: item.idOrderItem,
      idProduct: item.idProduct,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    })),
  };
}

export function mapToWorkshopOrderDTO(
  order: Order,
  user: Pick<User, 'firstName' | 'lastName'> | null,
): WorkshopOrderDTO {
  return {
    ...mapToOrderDTO(order),
    customer: {
      idUser: order.idUser,
      displayName: toCustomerDisplayName(user),
    },
  };
}
