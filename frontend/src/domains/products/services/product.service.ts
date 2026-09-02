import { API_URL } from '../../../config';
import { adaptAPIProduct, adaptAPIProducts } from '../adapters/product.adapter';
import type { APIProduct, Product } from '../adapters/product.adapter';

export type FetchProductByIdResult =
  | { ok: true; product: Product }
  | { ok: false; reason: 'not-found' | 'network' | 'server' };

/**
 * `GET /api/product/:id` — single product by id. A 404 status is surfaced
 * as its own `not-found` reason (distinct from other server errors) so
 * callers can render "product not found" separately from a generic load
 * failure, mirroring `product.astro`'s original inline behavior.
 *
 * Deliberately plain `fetch`, not `authFetch` (design.md D6, task 3.10): a
 * public, no-credentials read can never 401.
 */
export async function fetchProductById(id: string): Promise<FetchProductByIdResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/product/${id}`);
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (res.status === 404) {
    return { ok: false, reason: 'not-found' };
  }

  if (!res.ok) {
    return { ok: false, reason: 'server' };
  }

  const rawProduct = (await res.json()) as APIProduct;
  return { ok: true, product: adaptAPIProduct(rawProduct) };
}

export type FetchProductsResult =
  | { ok: true; products: Product[] }
  | { ok: false; reason: 'network' | 'server' };

/**
 * `GET /api/products` — full unpaginated product list, used by the
 * homepage's "Nuestros Seleccionados" grid (contrast with
 * `product.search.service.ts`'s paginated `/api/products/search`).
 *
 * Deliberately plain `fetch`, not `authFetch` (design.md D6, task 3.10) —
 * same reason as `fetchProductById`: a public, no-credentials read cannot
 * 401.
 */
export async function fetchProducts(): Promise<FetchProductsResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/products`);
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (!res.ok) {
    return { ok: false, reason: 'server' };
  }

  const resData = (await res.json()) as { products?: APIProduct[] };
  const rawProducts = resData?.products || [];
  return { ok: true, products: adaptAPIProducts(rawProducts) };
}
