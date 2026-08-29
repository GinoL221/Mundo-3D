import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { buildOpenApiSpec } from '../openapiSpec';

const { version } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'package.json'), 'utf-8')
) as { version: string };

interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
}

// Every real path + HTTP method mounted by the 6 route groups under
// backend/src/infrastructure/routes/api/ (see routes/api/*.ts). Kept in sync
// by hand with the actual `router.<method>(...)` calls — this is the
// "does the generated contract cover the real API" check requested for this
// change, not a re-derivation from the annotations themselves (that would
// only prove the annotations are internally consistent, not that they match
// the app).
const EXPECTED_ENDPOINTS: Array<[path: string, method: string]> = [
  // cart.ts
  ['/cart', 'get'],
  ['/cart', 'put'],
  // categories.ts
  ['/categories', 'get'],
  ['/categories', 'post'],
  ['/categories/{id}', 'get'],
  ['/categories/{id}', 'put'],
  ['/categories/{id}', 'delete'],
  // franchises.ts
  ['/franchises', 'get'],
  ['/franchises', 'post'],
  ['/franchises/{id}', 'get'],
  ['/franchises/{id}', 'put'],
  ['/franchises/{id}', 'delete'],
  // orders.ts
  ['/orders', 'post'],
  ['/orders', 'get'],
  ['/orders/mine', 'get'],
  ['/orders/{id}', 'get'],
  ['/orders/{id}/confirm-payment', 'post'],
  ['/orders/{id}/cancel', 'post'],
  // products.ts
  ['/products', 'get'],
  ['/products', 'post'],
  ['/product/{id}', 'get'],
  ['/products/latest', 'get'],
  ['/products/search', 'get'],
  ['/products/{id}', 'put'],
  ['/products/{id}', 'delete'],
  ['/products/{id}/stock', 'patch'],
  // users.ts
  ['/users/login', 'post'],
  ['/users/register', 'post'],
  ['/users/logout', 'post'],
  ['/users', 'get'],
  ['/users/{id}', 'get'],
];

describe('buildOpenApiSpec', () => {
  it('generates without throwing', () => {
    expect(() => buildOpenApiSpec()).not.toThrow();
  });

  it('produces a document that survives a JSON round trip (valid JSON)', () => {
    const spec = buildOpenApiSpec();
    expect(() => JSON.parse(JSON.stringify(spec))).not.toThrow();
  });

  describe('document shape', () => {
    let spec: OpenApiDocument;

    beforeAll(() => {
      spec = JSON.parse(JSON.stringify(buildOpenApiSpec())) as OpenApiDocument;
    });

    it('declares OpenAPI 3.0', () => {
      expect(spec.openapi).toBe('3.0.0');
    });

    it('carries a title and the backend package version', () => {
      expect(spec.info.title).toMatch(/Mundo-3D/i);
      expect(spec.info.version).toBe(version);
    });

    it.each(EXPECTED_ENDPOINTS)('documents %s [%s]', (path, method) => {
      expect(spec.paths).toHaveProperty(path);
      expect(spec.paths[path]).toHaveProperty(method);
    });

    it('covers exactly the endpoints mounted by the 6 route groups (no missing, no stale)', () => {
      const actual = Object.entries(spec.paths)
        .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`))
        .sort();
      const expected = EXPECTED_ENDPOINTS.map(([path, method]) => `${method.toUpperCase()} ${path}`).sort();
      expect(actual).toEqual(expected);
    });

    it('every operation declares at least one response', () => {
      for (const [path, methods] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          const responses = (operation as { responses?: Record<string, unknown> }).responses;
          expect(Object.keys(responses ?? {}).length).toBeGreaterThan(0);
        }
      }
    });

    it('registers component schemas for every resource, matching the real DTO shapes', () => {
      const { schemas } = spec.components;
      expect(Object.keys(schemas)).toEqual(
        expect.arrayContaining([
          'Order', 'OrderItem', 'Product', 'Category', 'Franchise', 'User', 'CartResult', 'ShoppingCartLine',
        ])
      );

      // OrderDTO.ts / OrderItemDTO — the DTOs this change was explicitly
      // required to mirror.
      expect(Object.keys((schemas.Order as { properties: object }).properties).sort()).toEqual(
        ['idOrder', 'idUser', 'status', 'items', 'totalAmount', 'createdAt', 'paymentReference'].sort()
      );
      expect(Object.keys((schemas.OrderItem as { properties: object }).properties).sort()).toEqual(
        ['idOrderItem', 'idProduct', 'productName', 'quantity', 'unitPrice', 'subtotal'].sort()
      );
    });
  });
});

describe('GET /api/openapi.json (real app wiring)', () => {
  it('serves the same spec with no auth required, through the actual app.js mount point', async () => {
    const fullApp = require('../../../app');

    const res = await request(fullApp).get('/api/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.paths).toHaveProperty('/orders');
  });
});
