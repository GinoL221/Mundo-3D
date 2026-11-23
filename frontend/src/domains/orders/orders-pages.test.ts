import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

describe('Orders pages design-system contract', () => {
  it('wires orders.astro and OrderList.astro to ui-kit primitives, hidden attributes, and mobile data-labels', () => {
    const page = readSource('../../pages/orders.astro');
    const component = readSource('./components/OrderList.astro');

    expect(page).toContain('<main class="orders-page system-frame system-section">');
    expect(page).toContain('class="ui-page-head orders-page__head"');
    expect(page).toMatch(/<h1 class="ui-page-head__title">[^<]+<\/h1>/);
    expect(page).not.toContain('class="sr-only"');

    expect(component).toContain('id="my-orders-region"');
    expect(component).toContain('aria-busy="true"');
    expect(component).toContain('id="my-orders-loading"');
    expect(component).toContain('class="ui-skeleton-list"');
    expect(component).toContain('id="my-orders-unauth"');
    expect(component).toContain('href="/login"');
    expect(component).toContain('href="/products"');
    expect(component).toContain('id="my-orders-error" class="ui-callout ui-callout--danger"');
    expect(component).toContain('id="my-orders-retry"');
    expect(component).toContain('id="my-orders-empty" class="ui-state ui-state--empty ui-state--open"');
    expect(component).toContain('Ver catálogo');
    expect(component).not.toContain('Ver productos');
    expect(component).toContain('class="ui-table-wrap orders-table-wrap"');
    expect(component).toContain('class="ui-table orders-table"');
    expect(component).toContain('<span class="sr-only">Acciones</span>');
    expect(component).toContain('class="ui-badge ui-badge--neutral order-row-status-badge"');
    expect(component).toContain('data-label="Pedido"');
    expect(component).toContain('data-label="Estado"');
    expect(component).toContain('data-label="Fecha"');
    expect(component).toContain('data-label="Total"');
    expect(component).not.toContain('style="display: none;"');
  });

  it('wires order.astro and OrderDetail.astro to ui-kit primitives, neutral states, and no payment reference or kicker', () => {
    const page = readSource('../../pages/order.astro');
    const component = readSource('./components/OrderDetail.astro');

    expect(page).toContain('<main class="orders-page system-frame system-section">');
    expect(page).toContain('class="ui-page-head orders-page__head"');
    expect(page).toMatch(/<h1 class="ui-page-head__title">[^<]+<\/h1>/);
    expect(page).toContain('id="order-back-link"');

    expect(component).toContain('id="order-region"');
    expect(component).toContain('aria-busy="true"');
    expect(component).toContain('id="order-loading"');
    expect(component).toContain('class="ui-skeleton-list"');
    expect(component).toContain('id="order-unauth"');
    expect(component).toContain('id="order-not-found"');
    expect(component).toContain('No encontramos este pedido');
    expect(component).toContain('id="order-error" class="ui-callout ui-callout--danger"');
    expect(component).toContain('id="order-retry"');
    expect(component).toContain('id="order-status" class="ui-badge ui-badge--neutral"');
    expect(component).not.toContain('order-payment-reference');
    expect(component).not.toContain('order-detail__label');
    expect(component).toContain('class="ui-table-wrap orders-table-wrap"');
    expect(component).toContain('data-label="Pieza"');
    expect(component).toContain('data-label="Cantidad"');
    expect(component).toContain('data-label="Precio unitario"');
    expect(component).toContain('data-label="Subtotal"');
    expect(component).not.toContain('style="display: none;"');
  });
});
