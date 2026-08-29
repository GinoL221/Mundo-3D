import type { ProductSearchPage } from '../adapters/product.adapter';
import type { ProductSearchCriteria } from './product.search.service';

// Pure formatting/href layer between the fetched ProductSearchPage and
// ProductSearch.astro's DOM-writing script, mirroring orderPresenter.ts's
// `presentMyOrdersPage` rationale — no Astro component-render test harness
// exists in this repo, so the testable logic lives here as plain functions.
export interface ProductSearchPresentation {
  isEmpty: boolean;
  pageLabel: string;
  prevHref: string | null;
  nextHref: string | null;
}

// Builds `/products?search=...&idCategory=...&page=N`, preserving every
// active filter — a plain `/products?page=2` would silently drop the
// user's search term (design.md decision).
function buildHref(criteria: ProductSearchCriteria, page: number): string {
  const params = new URLSearchParams();
  const trimmedSearch = criteria.search?.trim();
  if (trimmedSearch) params.set('search', trimmedSearch);
  if (criteria.idCategory !== undefined) params.set('idCategory', String(criteria.idCategory));
  if (criteria.idFranchise !== undefined) params.set('idFranchise', String(criteria.idFranchise));
  params.set('page', String(page));
  return `/products?${params.toString()}`;
}

export function presentProductSearchPage(
  page: ProductSearchPage,
  criteria: ProductSearchCriteria,
): ProductSearchPresentation {
  return {
    isEmpty: page.products.length === 0,
    pageLabel: `Página ${page.page} de ${Math.max(page.totalPages, 1)}`,
    prevHref: page.page > 1 ? buildHref(criteria, page.page - 1) : null,
    nextHref: page.page < page.totalPages ? buildHref(criteria, page.page + 1) : null,
  };
}
