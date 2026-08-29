// Order-related component schemas, split out of openapiSchemas.ts to keep
// that file under the repo's 250-line cap. Mirrors OrderDTO.ts /
// OrderItemDTO / OrderSummaryDTO (application/dtos/OrderDTO.ts) — never
// guessed.

const orderItemSchema = {
  type: 'object',
  properties: {
    idOrderItem: { type: 'integer' },
    idProduct: { type: 'integer', nullable: true },
    productName: { type: 'string' },
    quantity: { type: 'integer' },
    unitPrice: { type: 'number' },
    subtotal: { type: 'number' },
  },
  required: ['idOrderItem', 'idProduct', 'productName', 'quantity', 'unitPrice', 'subtotal'],
};

const orderSchema = {
  type: 'object',
  properties: {
    idOrder: { type: 'integer' },
    idUser: { type: 'integer' },
    status: { type: 'string' },
    items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
    totalAmount: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' },
    paymentReference: { type: 'string', nullable: true },
  },
  required: ['idOrder', 'idUser', 'status', 'items', 'totalAmount', 'createdAt', 'paymentReference'],
};

// Mirrors `OrderSummaryDTO` (application/dtos/OrderDTO.ts): the scalar
// subset used by `GET /orders/mine` (order-history spec) — no `items`.
const orderSummarySchema = {
  type: 'object',
  properties: {
    idOrder: { type: 'integer' },
    idUser: { type: 'integer' },
    status: { type: 'string' },
    totalAmount: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' },
    paymentReference: { type: 'string', nullable: true },
  },
  required: ['idOrder', 'idUser', 'status', 'totalAmount', 'createdAt', 'paymentReference'],
};

export const orderOpenapiSchemas = {
  OrderItem: orderItemSchema,
  Order: orderSchema,
  OrderSummary: orderSummarySchema,
};
