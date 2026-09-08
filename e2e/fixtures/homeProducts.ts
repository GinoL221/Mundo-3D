import type { Page } from '@playwright/test';

const fixtureJsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
};

export const homeProducts = [
  {
    idProduct: 101,
    nameProduct: 'Fixture Cube',
    price: 1200,
    descriptionProduct: 'Deterministic fixture product.',
    image: 'productoSinImagen.svg',
    category: 'Figura',
  },
  {
    idProduct: 102,
    nameProduct: 'Fixture Bust',
    price: 1800,
    descriptionProduct: 'Deterministic fixture product.',
    image: 'productoSinImagen.svg',
    category: 'Busto',
  },
  {
    idProduct: 103,
    nameProduct: 'Fixture Keychain',
    price: 900,
    descriptionProduct: 'Deterministic fixture product.',
    image: 'productoSinImagen.svg',
    category: 'Llavero',
  },
  {
    idProduct: 104,
    nameProduct: 'Fixture Mask',
    price: 1500,
    descriptionProduct: 'Deterministic fixture product.',
    image: 'productoSinImagen.svg',
    category: 'Máscara',
  },
  {
    idProduct: 105,
    nameProduct: 'Fixture Other',
    price: 1100,
    descriptionProduct: 'Deterministic fixture product.',
    image: 'productoSinImagen.svg',
    category: 'Otras',
  },
  {
    idProduct: 106,
    nameProduct: 'Fixture Reserve',
    price: 1300,
    descriptionProduct: 'Deterministic fixture product.',
    image: 'productoSinImagen.svg',
    category: 'Figura',
  },
] as const;

export async function installHomeProductFixtures(page: Page): Promise<void> {
  await page.route('**/api/products/latest', (route) =>
    route.fulfill({ headers: fixtureJsonHeaders, body: JSON.stringify(homeProducts[0]) }),
  );
  await page.route('**/api/products', (route) =>
    route.fulfill({ headers: fixtureJsonHeaders, body: JSON.stringify({ products: homeProducts }) }),
  );
}
