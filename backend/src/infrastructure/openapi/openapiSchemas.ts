// Component schemas for the generated OpenAPI 3.0 contract (GET /api/openapi.json).
//
// Each schema mirrors the REAL response shape returned by its controller —
// verified against the application DTOs (OrderDTO.ts, ProductDTO.ts,
// CategoryDTO.ts, FranchiseDTO.ts, ShoppingCartDTO.ts, UserDTO.ts) and, where
// a controller returns something DTOs don't cover on their own (e.g. the
// countByCategory map in ListProductsUseCase, or the `{ error, code }`
// envelope used by domain-error mapping), against the actual controller code
// — never guessed. Kept as plain objects (not TS interfaces) so swagger-jsdoc
// can embed them verbatim into `components.schemas`. Order-related schemas
// live in `orderOpenapiSchemas.ts` (split out to stay under the 250-line cap).

import { orderOpenapiSchemas } from './orderOpenapiSchemas';

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string', description: 'Human-readable message (Spanish), safe to show to end users.' },
  },
  required: ['error'],
};

const errorWithCodeSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string', description: 'Stable machine-readable error code for programmatic handling.' },
  },
  required: ['error', 'code'],
};

const stockShortageSchema = {
  type: 'object',
  properties: {
    idProduct: { type: 'integer' },
    productName: { type: 'string' },
    requested: { type: 'integer' },
    available: { type: 'integer' },
  },
  required: ['idProduct', 'productName', 'requested', 'available'],
};

const insufficientStockErrorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string', enum: ['INSUFFICIENT_STOCK'] },
    shortages: { type: 'array', items: { $ref: '#/components/schemas/StockShortage' } },
  },
  required: ['error', 'code', 'shortages'],
};

const categorySchema = {
  type: 'object',
  properties: {
    idCategory: { type: 'integer' },
    nameCategory: { type: 'string' },
  },
  required: ['idCategory', 'nameCategory'],
};

const franchiseSchema = {
  type: 'object',
  properties: {
    idFranchise: { type: 'integer' },
    nameFranchise: { type: 'string' },
  },
  required: ['idFranchise', 'nameFranchise'],
};

const productSchema = {
  type: 'object',
  properties: {
    idProduct: { type: 'integer' },
    nameProduct: { type: 'string' },
    price: { type: 'number' },
    descriptionProduct: { type: 'string', nullable: true },
    image: { type: 'string', nullable: true },
    idCategory: { type: 'integer' },
    idFranchise: { type: 'integer' },
    category: { type: 'string', description: 'Denormalized category name.' },
    material: { type: 'string', nullable: true },
    height: { type: 'number', nullable: true },
    width: { type: 'number', nullable: true },
    depth: { type: 'number', nullable: true },
    finish: { type: 'string', nullable: true },
    productionTime: { type: 'integer', nullable: true },
    stock: { type: 'integer' },
  },
  required: [
    'idProduct', 'nameProduct', 'price', 'descriptionProduct', 'image', 'idCategory',
    'idFranchise', 'category', 'material', 'height', 'width', 'depth', 'finish',
    'productionTime', 'stock',
  ],
};

const categoryCountInfoSchema = {
  type: 'object',
  properties: {
    count: { type: 'integer' },
    category: {
      nullable: true,
      type: 'object',
      properties: { idCategory: { type: 'integer' } },
      required: ['idCategory'],
    },
  },
  required: ['count', 'category'],
};

const listProductsResponseSchema = {
  type: 'object',
  properties: {
    count: { type: 'integer' },
    products: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
    countByCategory: {
      type: 'object',
      description: 'Keyed by category id (as string).',
      additionalProperties: { $ref: '#/components/schemas/CategoryCountInfo' },
    },
  },
  required: ['count', 'products', 'countByCategory'],
};

const cartLineProductSchema = {
  type: 'object',
  properties: {
    idProduct: { type: 'integer' },
    nameProduct: { type: 'string' },
    price: { type: 'number' },
    image: { type: 'string', nullable: true },
  },
  required: ['idProduct', 'nameProduct', 'price', 'image'],
};

const shoppingCartLineSchema = {
  type: 'object',
  properties: {
    idCart: { type: 'integer' },
    idUser: { type: 'integer' },
    idProduct: { type: 'integer' },
    quantity: { type: 'integer' },
    unitPrice: { type: 'number' },
    status: { type: 'string' },
    hasPriceDrift: { type: 'boolean', description: 'True when unitPrice no longer matches the live product price.' },
    product: { $ref: '#/components/schemas/CartLineProduct' },
  },
  required: ['idCart', 'idUser', 'idProduct', 'quantity', 'unitPrice', 'status', 'hasPriceDrift', 'product'],
};

const cartResultSchema = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { $ref: '#/components/schemas/ShoppingCartLine' } },
    total: { type: 'number' },
  },
  required: ['items', 'total'],
};

const cartSyncResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    cart: { $ref: '#/components/schemas/CartResult' },
  },
  required: ['success', 'cart'],
};

const userSchema = {
  type: 'object',
  properties: {
    idUser: { type: 'integer' },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    email: { type: 'string', format: 'email' },
    image: { type: 'string', nullable: true },
    idRole: { type: 'integer', nullable: true },
    category: { type: 'string', nullable: true },
  },
  required: ['idUser', 'firstName', 'lastName', 'email', 'image'],
};

const authResponseSchema = {
  type: 'object',
  properties: { user: { $ref: '#/components/schemas/User' } },
  required: ['user'],
};

const usersIndexResponseSchema = {
  type: 'object',
  properties: {
    count: { type: 'integer' },
    users: { type: 'array', items: { $ref: '#/components/schemas/User' } },
  },
  required: ['count', 'users'],
};

export const openapiSchemas = {
  Error: errorSchema,
  ErrorWithCode: errorWithCodeSchema,
  StockShortage: stockShortageSchema,
  InsufficientStockError: insufficientStockErrorSchema,
  Category: categorySchema,
  Franchise: franchiseSchema,
  Product: productSchema,
  CategoryCountInfo: categoryCountInfoSchema,
  ListProductsResponse: listProductsResponseSchema,
  CartLineProduct: cartLineProductSchema,
  ShoppingCartLine: shoppingCartLineSchema,
  CartResult: cartResultSchema,
  CartSyncResponse: cartSyncResponseSchema,
  User: userSchema,
  AuthResponse: authResponseSchema,
  UsersIndexResponse: usersIndexResponseSchema,
  ...orderOpenapiSchemas,
};
