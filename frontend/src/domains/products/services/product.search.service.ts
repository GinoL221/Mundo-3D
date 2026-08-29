import { API_URL } from '../../../config';
import type { ProductSearchPage } from '../adapters/product.adapter';

// Public, unauthenticated search endpoint (product-catalog-search spec) —
// no `withCredentials`, unlike order.service.ts's buyer-scoped calls.
export interface ProductSearchCriteria {
  search?: string;
  idCategory?: number;
  idFranchise?: number;
  page?: number;
}

export type FetchProductSearchResult =
  | { ok: true; page: ProductSearchPage }
  | { ok: false; reason: 'network' | 'server' };

/**
 * `GET /api/products/search` — builds a query string with only the
 * defined/non-empty criteria members, mirroring order.service.ts's
 * `fetchMyOrders`. Blank/whitespace-only `search` is trimmed away entirely
 * so a plain filter-only request never sends `search=`.
 */
export async function fetchProductSearch(criteria: ProductSearchCriteria): Promise<FetchProductSearchResult> {
  const params = new URLSearchParams();
  const trimmedSearch = criteria.search?.trim();
  if (trimmedSearch) params.set('search', trimmedSearch);
  if (criteria.idCategory !== undefined) params.set('idCategory', String(criteria.idCategory));
  if (criteria.idFranchise !== undefined) params.set('idFranchise', String(criteria.idFranchise));
  if (criteria.page !== undefined) params.set('page', String(criteria.page));
  const query = params.toString();

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/products/search${query ? `?${query}` : ''}`);
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (!res.ok) {
    return { ok: false, reason: 'server' };
  }

  const page = (await res.json()) as ProductSearchPage;
  return { ok: true, page };
}

export interface FilterOption {
  id: number;
  name: string;
}

interface CategoryDTO {
  idCategory: number;
  nameCategory: string;
}

interface FranchiseDTO {
  idFranchise: number;
  nameFranchise: string;
}

/**
 * One `Promise.all` over the existing public `GET /categories` and
 * `GET /franchises` endpoints — no new backend work needed (design.md
 * "Dependencies"). Falls back to empty arrays on any failure so the grid
 * still renders with the dropdowns left empty rather than blocking the
 * whole page on a filter-options failure.
 */
export async function fetchFilterOptions(): Promise<{ categories: FilterOption[]; franchises: FilterOption[] }> {
  try {
    const [categoriesRes, franchisesRes] = await Promise.all([
      fetch(`${API_URL}/api/categories`),
      fetch(`${API_URL}/api/franchises`),
    ]);

    if (!categoriesRes.ok || !franchisesRes.ok) {
      return { categories: [], franchises: [] };
    }

    const categoriesData = (await categoriesRes.json()) as CategoryDTO[];
    const franchisesData = (await franchisesRes.json()) as FranchiseDTO[];

    return {
      categories: categoriesData.map((c) => ({ id: c.idCategory, name: c.nameCategory })),
      franchises: franchisesData.map((f) => ({ id: f.idFranchise, name: f.nameFranchise })),
    };
  } catch {
    return { categories: [], franchises: [] };
  }
}
