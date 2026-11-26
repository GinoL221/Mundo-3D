import { API_URL, apiFetch, readBackendSleepingInfo } from '../../../config';
import { adaptAPIProduct, adaptAPIProducts, isPlaceholderImage } from '../adapters/product.adapter';
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
    res = await apiFetch(`${API_URL}/api/product/${id}`);
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
  | { ok: false; reason: 'network' | 'server' }
  | { ok: false; reason: 'sleeping'; wakeUrl: string | null };

export type FetchLatestProductResult =
  | { ok: true; product: Product }
  | { ok: false; reason: 'not-found' | 'network' | 'server' }
  | { ok: false; reason: 'sleeping'; wakeUrl: string | null };

export function selectLatestPhotoProduct(products: readonly Product[]): Product | undefined {
  let latest: Product | undefined;
  for (const product of products) {
    if (isPlaceholderImage(product.image)) continue;
    if (!latest || product.id > latest.id) {
      latest = product;
    }
  }
  return latest;
}

/**
 * `GET /api/products` — full unpaginated product list, used by the
 * homepage's "Piezas del catálogo" grid (contrast with
 * `product.search.service.ts`'s paginated `/api/products/search`).
 *
 * Deliberately plain `fetch`, not `authFetch` (design.md D6, task 3.10) —
 * same reason as `fetchProductById`: a public, no-credentials read cannot
 * 401.
 */
export async function fetchProducts(): Promise<FetchProductsResult> {
  let res: Response;
  try {
    res = await apiFetch(`${API_URL}/api/products`);
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (!res.ok) {
    const sleeping = await readBackendSleepingInfo(res);
    if (sleeping) {
      return { ok: false, reason: 'sleeping', wakeUrl: sleeping.wakeUrl };
    }
    return { ok: false, reason: 'server' };
  }

  const resData = (await res.json()) as { products?: APIProduct[] };
  const rawProducts = resData?.products || [];
  return { ok: true, products: adaptAPIProducts(rawProducts) };
}

/** Selects Home's hero specimen from live catalog data (newest product with
 * a real photo), falling back to the legacy latest-product endpoint when
 * the catalog fails or lacks a real photo.
 */
export async function fetchFeaturedProduct(
  catalogRequest: Promise<FetchProductsResult> = fetchProducts(),
): Promise<FetchLatestProductResult> {
  try {
    const catalog = await catalogRequest;
    if (catalog.ok) {
      const featured = selectLatestPhotoProduct(catalog.products);
      if (featured) return { ok: true, product: featured };
    } else if (catalog.reason === 'sleeping') {
      return { ok: false, reason: 'sleeping', wakeUrl: catalog.wakeUrl };
    }
  } catch {
    // Preserve the legacy latest-product fallback for an unexpected catalog failure.
  }

  return fetchLatestProduct();
}

/**
 * `GET /api/products/latest` — fallback product for Home's featured piece.
 * A missing catalog remains distinct from a transport/server failure.
 */
export async function fetchLatestProduct(): Promise<FetchLatestProductResult> {
  let res: Response;
  try {
    res = await apiFetch(`${API_URL}/api/products/latest`);
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (res.status === 404) {
    return { ok: false, reason: 'not-found' };
  }

  if (!res.ok) {
    const sleeping = await readBackendSleepingInfo(res);
    if (sleeping) {
      return { ok: false, reason: 'sleeping', wakeUrl: sleeping.wakeUrl };
    }
    return { ok: false, reason: 'server' };
  }

  const rawProduct = (await res.json()) as APIProduct;
  return { ok: true, product: adaptAPIProduct(rawProduct) };
}
