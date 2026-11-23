import { describe, expect, it } from 'vitest';
import {
  formatCatalogPrice,
  formatProductCardAriaLabel,
  presentProductSearchPage,
} from './productSearchPresenter';
import type { ProductSearchPage } from '../adapters/product.adapter';
import type { ProductSearchCriteria } from './product.search.service';

const SAMPLE_PAGE: ProductSearchPage = {
  products: [
    { idProduct: 1, nameProduct: 'Goku', price: 1500, descriptionProduct: null, image: null, category: 'Figura' },
  ],
  page: 1,
  pageSize: 20,
  total: 21,
  totalPages: 2,
};

describe('presentProductSearchPage', () => {
  it('flags an empty page when there are no products', () => {
    const presentation = presentProductSearchPage({ ...SAMPLE_PAGE, products: [], total: 0, totalPages: 0 }, {});
    expect(presentation.isEmpty).toBe(true);
  });

  it('flags a non-empty page when products exist', () => {
    const presentation = presentProductSearchPage(SAMPLE_PAGE, {});
    expect(presentation.isEmpty).toBe(false);
  });

  it('builds a page label from page and totalPages', () => {
    const presentation = presentProductSearchPage(SAMPLE_PAGE, {});
    expect(presentation.pageLabel).toBe('Página 1 de 2');
  });

  it('nulls prevHref on the first page and computes nextHref preserving active filters', () => {
    const criteria: ProductSearchCriteria = { search: 'goku', idCategory: 3 };
    const presentation = presentProductSearchPage(SAMPLE_PAGE, criteria);

    expect(presentation.prevHref).toBeNull();
    expect(presentation.nextHref).not.toBeNull();

    const nextUrl = new URLSearchParams(presentation.nextHref!.split('?')[1]);
    expect(nextUrl.get('search')).toBe('goku');
    expect(nextUrl.get('idCategory')).toBe('3');
    expect(nextUrl.get('page')).toBe('2');
    expect(presentation.nextHref!.startsWith('/products?')).toBe(true);
  });

  it('nulls nextHref on the last page and computes prevHref preserving active filters', () => {
    const criteria: ProductSearchCriteria = { search: 'goku', idFranchise: 5 };
    const lastPage: ProductSearchPage = { ...SAMPLE_PAGE, page: 2 };
    const presentation = presentProductSearchPage(lastPage, criteria);

    expect(presentation.nextHref).toBeNull();
    expect(presentation.prevHref).not.toBeNull();

    const prevUrl = new URLSearchParams(presentation.prevHref!.split('?')[1]);
    expect(prevUrl.get('search')).toBe('goku');
    expect(prevUrl.get('idFranchise')).toBe('5');
    expect(prevUrl.get('page')).toBe('1');
  });

  it('omits absent filters entirely from prev/next hrefs, not as empty query params', () => {
    const lastPage: ProductSearchPage = { ...SAMPLE_PAGE, page: 2 };
    const presentation = presentProductSearchPage(lastPage, {});

    const prevUrl = new URLSearchParams(presentation.prevHref!.split('?')[1]);
    expect(prevUrl.has('search')).toBe(false);
    expect(prevUrl.has('idCategory')).toBe(false);
    expect(prevUrl.has('idFranchise')).toBe(false);
    expect(prevUrl.get('page')).toBe('1');
  });
});

describe('formatCatalogPrice', () => {
  it('formats integer prices with es-AR thousand separators and a space after $', () => {
    expect(formatCatalogPrice(1500)).toBe('$ 1.500');
    expect(formatCatalogPrice(12500)).toBe('$ 12.500');
    expect(formatCatalogPrice(0)).toBe('$ 0');
  });

  it('formats non-integer prices with two decimal places in es-AR', () => {
    expect(formatCatalogPrice(1500.5)).toBe('$ 1.500,50');
    expect(formatCatalogPrice(99.99)).toBe('$ 99,99');
  });

  it('handles non-finite values and negative zero safely', () => {
    expect(formatCatalogPrice(Number.NaN)).toBe('$ 0');
    expect(formatCatalogPrice(Number.POSITIVE_INFINITY)).toBe('$ 0');
    expect(formatCatalogPrice(-0)).toBe('$ 0');
    expect(formatCatalogPrice(1500.004)).toBe('$ 1.500');
  });
});

describe('formatProductCardAriaLabel', () => {
  it('combines the piece name and formatted price with an em dash', () => {
    expect(formatProductCardAriaLabel('Goku Super Saiyan', 1500)).toBe('Goku Super Saiyan — $ 1.500');
    expect(formatProductCardAriaLabel('Llavero Mario', 850.5)).toBe('Llavero Mario — $ 850,50');
  });
});
