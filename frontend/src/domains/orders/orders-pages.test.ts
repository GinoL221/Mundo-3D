import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

describe('Orders pages design-system contract', () => {
  it('wires orders.astro and OrderList.astro to orders.css layout, states, and mobile data-labels', () => {
    const page = readSource('../../pages/orders.astro');
    const component = readSource('./components/OrderList.astro');

    expect(page).toContain('<main class="orders-page system-frame system-section">');
    expect(page).toContain('<header class="orders-page__header">');
    expect(page).toMatch(/<h1>[^<]+<\/h1>/);
    expect(page).not.toContain('class="sr-only"');

    expect(component).toContain('id="my-orders-loading"');
    expect(component).toContain('class="orders-state"');
    expect(component).toContain('class="orders-state orders-state--error"');
    expect(component).toContain('class="orders-action"');
    expect(component).toContain('class="order-list__table-frame"');
    expect(component).toContain('class="order-row-id" data-label="Pedido"');
    expect(component).toContain('class="order-row-status" data-label="Estado"');
    expect(component).toContain('class="order-row-created-at" data-label="Fecha"');
    expect(component).toContain('class="order-row-total" data-label="Total"');
    expect(component).toContain('class="order-row-action"');
    expect(component).toContain("errorEl.style.display = 'grid'");
    expect(component).toContain("emptyEl.style.display = 'grid'");
    expect(component).toContain("prevHref ? 'inline-flex' : 'none'");
    expect(component).toContain("nextHref ? 'inline-flex' : 'none'");
  });

  it('wires order.astro and OrderDetail.astro to orders.css summary, total, states, and mobile data-labels', () => {
    const page = readSource('../../pages/order.astro');
    const component = readSource('./components/OrderDetail.astro');

    expect(page).toContain('<main class="orders-page system-frame system-section">');
    expect(page).toContain('<header class="orders-page__header">');
    expect(page).toMatch(/<h1>[^<]+<\/h1>/);
    expect(page).not.toContain('class="sr-only"');
    expect(page).toContain('href="/orders"');

    expect(component).toContain('id="order-loading"');
    expect(component).toContain('class="orders-state"');
    expect(component).toContain('class="orders-state orders-state--error"');
    expect(component).toContain('class="order-detail__summary"');
    expect(component).toContain('class="order-detail__meta"');
    expect(component).toContain('class="order-detail__table-frame"');
    expect(component).toContain('class="order-detail__total"');
    expect(component).toContain('class="order-item-name" data-label="Producto"');
    expect(component).toContain('class="order-item-qty" data-label="Cantidad"');
    expect(component).toContain('class="order-item-price" data-label="Precio unitario"');
    expect(component).toContain('class="order-item-subtotal" data-label="Subtotal"');
    expect(component).toContain("errorEl.style.display = 'grid'");
    expect(component).toContain("contentEl.style.display = 'grid'");
  });
});
