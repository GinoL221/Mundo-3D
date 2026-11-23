import { describe, expect, it } from 'vitest';
import {
  buildProductFormData,
  formatAdminPrice,
  formatProductMeta,
  getStockStatus,
  parseAdminProductId,
  parseMaterialValue,
  resolveFieldIdForApiKey,
  resolveMaterialInput,
  validateProductForm,
  type ProductFormValues,
} from './productAdminHelpers';

function makeValidValues(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    nameProduct: 'Mario Bros Fig',
    price: '18500',
    descriptionProduct: 'Figura impresa en 3D',
    idCategory: '1',
    idFranchise: '2',
    materialSelect: '',
    materialCustom: '',
    height: '',
    width: '',
    depth: '',
    finish: '',
    productionTime: '',
    stock: '',
    imageFile: new File(['img'], 'mario.png', { type: 'image/png' }),
    ...overrides,
  };
}

describe('formatAdminPrice', () => {
  it('formats integer prices with es-AR thousand separators and space after $', () => {
    expect(formatAdminPrice(18500)).toBe('$ 18.500');
    expect(formatAdminPrice(950)).toBe('$ 950');
    expect(formatAdminPrice(1250000)).toBe('$ 1.250.000');
  });

  it('formats prices with cents using two decimals and integers with none', () => {
    expect(formatAdminPrice(7200.5)).toBe('$ 7.200,50');
    expect(formatAdminPrice(1500.5)).toBe('$ 1.500,50');
    expect(formatAdminPrice(1500.25)).toBe('$ 1.500,25');
    expect(formatAdminPrice(1500.05)).toBe('$ 1.500,05');
    expect(formatAdminPrice(7200.001)).toBe('$ 7.200');
  });

  it('falls back to $ 0 when price is non-finite', () => {
    expect(formatAdminPrice(Number.NaN)).toBe('$ 0');
    expect(formatAdminPrice(Number.POSITIVE_INFINITY)).toBe('$ 0');
  });
});

describe('getStockStatus', () => {
  it('returns danger / Sin stock when stock is 0 or negative', () => {
    expect(getStockStatus(0)).toEqual({
      tier: 'out',
      label: 'Sin stock',
      badgeClass: 'ui-badge--danger',
    });
    expect(getStockStatus(-1)).toEqual({
      tier: 'out',
      label: 'Sin stock',
      badgeClass: 'ui-badge--danger',
    });
  });

  it('returns warning / Stock bajo when stock is between 1 and 3', () => {
    expect(getStockStatus(1).tier).toBe('low');
    expect(getStockStatus(3)).toEqual({
      tier: 'low',
      label: 'Stock bajo',
      badgeClass: 'ui-badge--warning',
    });
  });

  it('returns success / En stock when stock is greater than 3', () => {
    expect(getStockStatus(4)).toEqual({
      tier: 'ok',
      label: 'En stock',
      badgeClass: 'ui-badge--success',
    });
    expect(getStockStatus(20).tier).toBe('ok');
  });
});

describe('formatProductMeta', () => {
  it('formats category, material, and full dimensions when present', () => {
    expect(
      formatProductMeta({
        category: 'Figura',
        material: 'PLA',
        height: 14,
        width: 10,
        depth: 8,
      }),
    ).toBe('Figura · PLA · 14 × 10 × 8 cm');
  });

  it('handles null material and null dimensions cleanly without printing null', () => {
    expect(
      formatProductMeta({
        category: 'Busto',
        material: null,
        height: null,
        width: null,
        depth: null,
      }),
    ).toBe('Busto');
  });

  it('formats partial dimensions when only some axes exist', () => {
    expect(
      formatProductMeta({
        category: 'Llavero',
        material: 'PETG',
        height: 5,
        width: null,
        depth: null,
      }),
    ).toBe('Llavero · PETG · 5 cm');
  });
});

describe('material parsing and resolution', () => {
  it('parses empty or null material into empty select and custom detail', () => {
    expect(parseMaterialValue(null)).toEqual({ selectValue: '', customDetail: '' });
    expect(parseMaterialValue(undefined)).toEqual({ selectValue: '', customDetail: '' });
    expect(parseMaterialValue('   ')).toEqual({ selectValue: '', customDetail: '' });
  });

  it('parses guided materials directly', () => {
    expect(parseMaterialValue('PLA')).toEqual({ selectValue: 'PLA', customDetail: '' });
    expect(parseMaterialValue('Resina')).toEqual({ selectValue: 'Resina', customDetail: '' });
    expect(parseMaterialValue('PETG')).toEqual({ selectValue: 'PETG', customDetail: '' });
    expect(parseMaterialValue('Flex')).toEqual({ selectValue: 'Flex', customDetail: '' });
  });

  it('parses "Otros: <detail>" into Otros option + detail', () => {
    expect(parseMaterialValue('Otros: ABS técnico')).toEqual({
      selectValue: 'Otros',
      customDetail: 'ABS técnico',
    });
  });

  it('resolves empty select to null without error', () => {
    expect(resolveMaterialInput('', '')).toEqual({ value: null, error: null });
  });

  it('resolves guided material directly', () => {
    expect(resolveMaterialInput('PETG', 'ignored')).toEqual({ value: 'PETG', error: null });
  });

  it('resolves "Otros" with detail to "Otros: <detail>" and rejects empty detail', () => {
    expect(resolveMaterialInput('Otros', '  Nylon PA12  ')).toEqual({
      value: 'Otros: Nylon PA12',
      error: null,
    });
    const invalid = resolveMaterialInput('Otros', '   ');
    expect(invalid.value).toBeNull();
    expect(invalid.error).toBeTruthy();
  });
});

describe('validateProductForm', () => {
  it('returns no errors for valid create values', () => {
    expect(validateProductForm(makeValidValues(), 'create')).toEqual({});
  });

  it('validates required fields, bounds, and image requirement on create', () => {
    const errors = validateProductForm(
      makeValidValues({
        nameProduct: 'Abc',
        price: '0',
        descriptionProduct: '',
        idCategory: '',
        idFranchise: '',
        materialSelect: 'Otros',
        materialCustom: '',
        height: '-2',
        productionTime: '40',
        stock: '-1',
        imageFile: null,
      }),
      'create',
    );

    expect(errors.nameProduct).toBeTruthy();
    expect(errors.price).toBeTruthy();
    expect(errors.descriptionProduct).toBeTruthy();
    expect(errors.idCategory).toBeTruthy();
    expect(errors.idFranchise).toBeTruthy();
    expect(errors.materialCustom).toBeTruthy();
    expect(errors.height).toBeTruthy();
    expect(errors.productionTime).toBeTruthy();
    expect(errors.stock).toBeTruthy();
    expect(errors.image).toBeTruthy();
  });

  it('does not require image or validate stock on edit', () => {
    const errors = validateProductForm(
      makeValidValues({
        imageFile: null,
        stock: '-5',
      }),
      'edit',
    );
    expect(errors).toEqual({});
  });

  it('rejects unsupported image extensions', () => {
    const errors = validateProductForm(
      makeValidValues({
        imageFile: new File(['gif'], 'mario.gif', { type: 'image/gif' }),
      }),
      'edit',
    );
    expect(errors.image).toBeTruthy();
  });
});

describe('buildProductFormData', () => {
  it('omits empty optional fields and empty material in create mode', () => {
    const fd = buildProductFormData(makeValidValues(), 'create');

    expect(fd.get('nameProduct')).toBe('Mario Bros Fig');
    expect(fd.get('price')).toBe('18500');
    expect(fd.get('descriptionProduct')).toBe('Figura impresa en 3D');
    expect(fd.get('idCategory')).toBe('1');
    expect(fd.get('idFranchise')).toBe('2');
    expect(fd.has('material')).toBe(false);
    expect(fd.has('height')).toBe(false);
    expect(fd.has('width')).toBe(false);
    expect(fd.has('depth')).toBe(false);
    expect(fd.has('finish')).toBe(false);
    expect(fd.has('productionTime')).toBe(false);
    expect(fd.has('stock')).toBe(false);
    expect(fd.get('image')).toBeInstanceOf(File);
  });

  it('includes populated optional fields, custom material prefix, and stock in create mode', () => {
    const fd = buildProductFormData(
      makeValidValues({
        materialSelect: 'Otros',
        materialCustom: 'ABS',
        height: '15',
        width: '10',
        depth: '8',
        finish: 'Mate',
        productionTime: '4',
        stock: '6',
      }),
      'create',
    );

    expect(fd.get('material')).toBe('Otros: ABS');
    expect(fd.get('height')).toBe('15');
    expect(fd.get('width')).toBe('10');
    expect(fd.get('depth')).toBe('8');
    expect(fd.get('finish')).toBe('Mate');
    expect(fd.get('productionTime')).toBe('4');
    expect(fd.get('stock')).toBe('6');
  });

  it('never appends stock or empty image in edit mode', () => {
    const fd = buildProductFormData(
      makeValidValues({
        materialSelect: 'PLA',
        stock: '99',
        imageFile: null,
      }),
      'edit',
    );

    expect(fd.get('material')).toBe('PLA');
    expect(fd.has('stock')).toBe(false);
    expect(fd.has('image')).toBe(false);
  });

  it('sends empty strings for cleared optional fields in edit mode while keeping stock omitted', () => {
    const fd = buildProductFormData(
      makeValidValues({
        materialSelect: '',
        materialCustom: '',
        height: '',
        width: '   ',
        depth: '',
        finish: '   ',
        productionTime: '',
        stock: '12',
        imageFile: null,
      }),
      'edit',
    );

    expect(fd.get('material')).toBe('');
    expect(fd.get('height')).toBe('');
    expect(fd.get('width')).toBe('');
    expect(fd.get('depth')).toBe('');
    expect(fd.get('finish')).toBe('');
    expect(fd.get('productionTime')).toBe('');
    expect(fd.has('stock')).toBe(false);
    expect(fd.has('image')).toBe(false);
  });
});

describe('parseAdminProductId', () => {
  it('parses strictly positive integer product IDs and rejects invalid values', () => {
    expect(parseAdminProductId('7')).toBe(7);
    expect(parseAdminProductId(' 42 ')).toBe(42);
    expect(parseAdminProductId(null)).toBeNull();
    expect(parseAdminProductId('')).toBeNull();
    expect(parseAdminProductId('0')).toBeNull();
    expect(parseAdminProductId('-3')).toBeNull();
    expect(parseAdminProductId('1.5')).toBeNull();
    expect(parseAdminProductId('1e2')).toBeNull();
    expect(parseAdminProductId('abc')).toBeNull();
  });
});

describe('resolveFieldIdForApiKey', () => {
  it('maps known API keys and falls back to null for unknown keys', () => {
    expect(resolveFieldIdForApiKey('nameProduct')).toBe('nameProduct');
    expect(resolveFieldIdForApiKey('material')).toBe('material');
    expect(resolveFieldIdForApiKey('unknownField')).toBeNull();
  });
});
