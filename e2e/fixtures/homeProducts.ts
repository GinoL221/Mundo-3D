import type { Page } from '@playwright/test';

const fixtureJsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
};

export const homeProducts = [
  {
    idProduct: 101,
    nameProduct: 'Cubo de Compañía de Portal',
    price: 24500,
    descriptionProduct: 'Deterministic fixture for the editorial Home product.',
    image: 'cubo_compania_portal.jpg',
    category: 'Figura',
  },
  {
    idProduct: 102,
    nameProduct: 'Fixture Bust',
    price: 1800,
    descriptionProduct: 'Deterministic fixture product.',
    image: 'busto_darth_vader.jpg',
    category: 'Busto',
  },
  {
    idProduct: 103,
    nameProduct: 'Fixture Keychain',
    price: 900,
    descriptionProduct: 'Deterministic fixture product.',
    image: 'llavero_batisenal.jpg',
    category: 'Llavero',
  },
  {
    idProduct: 104,
    nameProduct: 'Fixture Mask',
    price: 1500,
    descriptionProduct: 'Deterministic fixture product.',
    image: 'mascara_batman.jpg',
    category: 'Máscara',
  },
  {
    idProduct: 105,
    nameProduct: 'Fixture Other',
    price: 1100,
    descriptionProduct: 'Deterministic fixture product.',
    image: 'soporte_maceta_groot.jpg',
    category: 'Otras',
  },
  {
    idProduct: 106,
    nameProduct: 'Fixture Reserve',
    price: 1300,
    descriptionProduct: 'Deterministic fixture product.',
    image: 'figura_mario.jpg',
    category: 'Figura',
  },
] as const;

export async function installHomeProductFixtures(page: Page): Promise<void> {
  await page.route('**/api/products/latest', (route) =>
    route.fulfill({ headers: fixtureJsonHeaders, body: JSON.stringify(homeProducts[0]) }),
  );
  await page.route('**/api/products', (route) =>
    route.fulfill({
      headers: fixtureJsonHeaders,
      body: JSON.stringify({ products: homeProducts }),
    }),
  );
}
