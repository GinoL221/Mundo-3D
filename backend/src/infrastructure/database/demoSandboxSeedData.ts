import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error: bcryptjs does not provide native TypeScript types in all environments
import bcryptjs from 'bcryptjs';
import { Role } from '../../domain/Role';

export const DEMO_SANDBOX_SEED_VERSION = 'v1-catalog-17-user-staff';

export const DEMO_SANDBOX_EXPECTED_COUNTS = {
  categories: 10,
  franchises: 10,
  products: 17,
  users: 2,
} as const;

export interface DemoSandboxCategorySeed {
  idCategory: number;
  nameCategory: string;
}

export interface DemoSandboxFranchiseSeed {
  idFranchise: number;
  nameFranchise: string;
}

export interface DemoSandboxProductSeed {
  idProduct: number;
  nameProduct: string;
  price: number;
  descriptionProduct: string | null;
  image: string | null;
  idCategory: number;
  idFranchise: number;
  material: string | null;
  height: number | null;
  width: number | null;
  depth: number | null;
  finish: string | null;
  productionTime: number | null;
  stock: number;
}

export interface DemoSandboxUserSeed {
  idUser: number;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  passwordUser: string;
  idRole: Role.USER | Role.STAFF;
  category: 'User' | 'Staff';
  emailVerifiedAt: Date;
}

export interface DemoSandboxSeedBundle {
  readonly seedVersion: string;
  categories: DemoSandboxCategorySeed[];
  franchises: DemoSandboxFranchiseSeed[];
  products: DemoSandboxProductSeed[];
  users: DemoSandboxUserSeed[];
}

const SLOT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const DEFAULT_VERIFIED_AT_MS = Date.parse('2026-01-01T00:00:00.000Z');

const CATEGORY_NAMES: readonly string[] = [
  'Llavero',
  'Busto',
  'Figura',
  'Mascara',
  'Otras',
  'Lámpara',
  'Accesorios',
  'Terror/Fantasía',
  'Utilitarios',
  'Juguetes',
];

const FRANCHISE_NAMES: readonly string[] = [
  'Marvel',
  'DC',
  'Disney',
  'Otra',
  'Zelda',
  'Star Wars',
  'Portal',
  'Pokemon',
  'Nintendo',
  'Terror/Fantasía',
];

let cachedProducts: readonly DemoSandboxProductSeed[] | null = null;
let cachedPasswordHash: string | null = null;

function resolveProductsJsonPath(): string {
  const candidates = [
    path.resolve(__dirname, '../../database/data/products.json'),
    path.resolve(__dirname, '../../../src/database/data/products.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('Demo sandbox seed catalog products.json not found');
}

function readStringOrNull(raw: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string') return value;
    if (value === null) return null;
  }
  return null;
}

function readNumberOrNull(raw: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value === null) return null;
  }
  return null;
}

function loadCatalogProducts(): readonly DemoSandboxProductSeed[] {
  if (cachedProducts) return cachedProducts;
  const parsed: unknown = JSON.parse(fs.readFileSync(resolveProductsJsonPath(), 'utf8'));
  if (!Array.isArray(parsed) || parsed.length !== DEMO_SANDBOX_EXPECTED_COUNTS.products) {
    throw new Error(
      `Demo sandbox seed requires exactly ${DEMO_SANDBOX_EXPECTED_COUNTS.products} catalog products`,
    );
  }
  cachedProducts = parsed.map((entry: unknown, index: number): DemoSandboxProductSeed => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Invalid product entry in demo sandbox seed catalog');
    }
    const raw = entry as Record<string, unknown>;
    const nameProduct = readStringOrNull(raw, 'NameProduct', 'nameProduct');
    const price = readNumberOrNull(raw, 'Price', 'price');
    const idCategory = readNumberOrNull(raw, 'IDCategory', 'idCategory');
    const idFranchise = readNumberOrNull(raw, 'IDFranchise', 'idFranchise');
    if (!nameProduct || price === null || idCategory === null || idFranchise === null) {
      throw new Error('Incomplete product entry in demo sandbox seed catalog');
    }
    const stock = readNumberOrNull(raw, 'Stock', 'stock') ?? 50;
    return {
      idProduct: index + 1,
      nameProduct,
      price,
      descriptionProduct: readStringOrNull(raw, 'DescriptionProduct', 'descriptionProduct'),
      image: readStringOrNull(raw, 'Image', 'image'),
      idCategory,
      idFranchise,
      material: readStringOrNull(raw, 'Material', 'material'),
      height: readNumberOrNull(raw, 'Height', 'height'),
      width: readNumberOrNull(raw, 'Width', 'width'),
      depth: readNumberOrNull(raw, 'Depth', 'depth'),
      finish: readStringOrNull(raw, 'Finish', 'finish'),
      productionTime: readNumberOrNull(raw, 'ProductionTime', 'productionTime'),
      stock,
    };
  });
  return cachedProducts;
}

function getSyntheticPasswordHash(): string {
  if (!cachedPasswordHash) {
    const unusableSecret = crypto.randomBytes(32).toString('hex');
    cachedPasswordHash = String(bcryptjs.hashSync(unusableSecret, 10));
  }
  return cachedPasswordHash;
}

export function buildDemoSandboxSlotEmails(slotId: string): { buyer: string; staff: string } {
  if (typeof slotId !== 'string' || !SLOT_ID_PATTERN.test(slotId)) {
    throw new Error('Invalid demo sandbox slot id');
  }
  const normalized = slotId.toLowerCase();
  return {
    buyer: `demo.buyer+${normalized}@sandbox.mundo3d.invalid`,
    staff: `demo.staff+${normalized}@sandbox.mundo3d.invalid`,
  };
}

export function buildDemoSandboxSeedData(
  slotId: string,
  verifiedAt: Date = new Date(DEFAULT_VERIFIED_AT_MS),
): DemoSandboxSeedBundle {
  const emails = buildDemoSandboxSlotEmails(slotId);
  const passwordUser = getSyntheticPasswordHash();
  const verifiedTimestamp = new Date(verifiedAt.getTime());

  const users: DemoSandboxUserSeed[] = [
    {
      idUser: 1,
      firstName: 'Demo',
      lastName: 'Buyer',
      email: emails.buyer,
      image: null,
      passwordUser,
      idRole: Role.USER,
      category: 'User',
      emailVerifiedAt: new Date(verifiedTimestamp.getTime()),
    },
    {
      idUser: 2,
      firstName: 'Demo',
      lastName: 'Staff',
      email: emails.staff,
      image: null,
      passwordUser,
      idRole: Role.STAFF,
      category: 'Staff',
      emailVerifiedAt: new Date(verifiedTimestamp.getTime()),
    },
  ];

  return {
    seedVersion: DEMO_SANDBOX_SEED_VERSION,
    categories: CATEGORY_NAMES.map((nameCategory, index) => ({
      idCategory: index + 1,
      nameCategory,
    })),
    franchises: FRANCHISE_NAMES.map((nameFranchise, index) => ({
      idFranchise: index + 1,
      nameFranchise,
    })),
    products: loadCatalogProducts().map((product) => ({ ...product })),
    users,
  };
}
