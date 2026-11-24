import type { AdminProductDTO } from '../services/product.admin.service';

export const GUIDED_MATERIALS = ['PLA', 'Resina', 'PETG', 'Flex'] as const;
export const CUSTOM_MATERIAL_OPTION = 'Otros' as const;
export const CUSTOM_MATERIAL_PREFIX = 'Otros: ';

export type StockStatusTier = 'out' | 'low' | 'ok';

export interface StockStatusPresentation {
  tier: StockStatusTier;
  label: string;
  badgeClass: 'ui-badge--danger' | 'ui-badge--warning' | 'ui-badge--success';
}

export interface ProductFormValues {
  nameProduct: string;
  price: string;
  descriptionProduct: string;
  idCategory: string;
  idFranchise: string;
  materialSelect: string;
  materialCustom: string;
  height: string;
  width: string;
  depth: string;
  finish: string;
  productionTime: string;
  stock?: string;
  imageFile?: File | null;
}

const KNOWN_FORM_FIELD_IDS = new Set([
  'nameProduct',
  'price',
  'descriptionProduct',
  'idCategory',
  'idFranchise',
  'material',
  'materialCustom',
  'height',
  'width',
  'depth',
  'finish',
  'productionTime',
  'stock',
  'image',
]);

const INTEGER_PRICE_FORMATTER = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 0,
});

const DECIMAL_PRICE_FORMATTER = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAdminPrice(price: number): string {
  if (!Number.isFinite(price)) {
    return '$ 0';
  }
  const roundedCents = Math.round(price * 100);
  const normalized = roundedCents === 0 ? 0 : roundedCents / 100;
  if (roundedCents % 100 === 0) {
    return `$ ${INTEGER_PRICE_FORMATTER.format(normalized)}`;
  }
  return `$ ${DECIMAL_PRICE_FORMATTER.format(normalized)}`;
}

export function getStockStatus(stock: number): StockStatusPresentation {
  if (stock <= 0) {
    return { tier: 'out', label: 'Sin stock', badgeClass: 'ui-badge--danger' };
  }
  if (stock <= 3) {
    return { tier: 'low', label: 'Stock bajo', badgeClass: 'ui-badge--warning' };
  }
  return { tier: 'ok', label: 'En stock', badgeClass: 'ui-badge--success' };
}

export function formatProductMeta(
  product: Pick<AdminProductDTO, 'category' | 'material' | 'height' | 'width' | 'depth'>,
): string {
  const parts: string[] = [];
  const category = product.category?.trim();
  if (category) parts.push(category);

  const material = product.material?.trim();
  if (material) parts.push(material);

  const dims = [product.height, product.width, product.depth].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  if (dims.length > 0) {
    parts.push(`${dims.join(' × ')} cm`);
  }

  return parts.join(' · ');
}

export function parseMaterialValue(
  material: string | null | undefined,
): { selectValue: string; customDetail: string } {
  const trimmed = material?.trim() ?? '';
  if (!trimmed) {
    return { selectValue: '', customDetail: '' };
  }

  if ((GUIDED_MATERIALS as readonly string[]).includes(trimmed)) {
    return { selectValue: trimmed, customDetail: '' };
  }

  if (trimmed === CUSTOM_MATERIAL_OPTION) {
    return { selectValue: CUSTOM_MATERIAL_OPTION, customDetail: '' };
  }

  if (trimmed.startsWith(CUSTOM_MATERIAL_PREFIX)) {
    return {
      selectValue: CUSTOM_MATERIAL_OPTION,
      customDetail: trimmed.slice(CUSTOM_MATERIAL_PREFIX.length).trim(),
    };
  }

  return { selectValue: CUSTOM_MATERIAL_OPTION, customDetail: trimmed };
}

export function resolveMaterialInput(
  selectValue: string,
  customDetail: string,
): { value: string | null; error: string | null } {
  const selected = selectValue.trim();
  if (!selected) {
    return { value: null, error: null };
  }

  if ((GUIDED_MATERIALS as readonly string[]).includes(selected)) {
    return { value: selected, error: null };
  }

  if (selected === CUSTOM_MATERIAL_OPTION) {
    const detail = customDetail.trim();
    if (!detail) {
      return {
        value: null,
        error: 'Especificá el material personalizado (ej. ABS o Nylon).',
      };
    }
    return { value: `${CUSTOM_MATERIAL_PREFIX}${detail}`, error: null };
  }

  return { value: selected, error: null };
}

function isSupportedImageFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return lower.endsWith('.jpg') || lower.endsWith('.png');
}

export interface ProductValidationOptions {
  requireImageOnCreate?: boolean;
}

export function validateProductForm(
  values: ProductFormValues,
  mode: 'create' | 'edit',
  options: ProductValidationOptions = {},
): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = values.nameProduct.trim();
  if (!name) {
    errors.nameProduct = 'Ingresá el nombre de la pieza.';
  } else if (name.length < 5 || name.length > 20) {
    errors.nameProduct = 'El nombre debe tener entre 5 y 20 caracteres.';
  }

  const priceRaw = values.price.trim();
  const priceNum = Number(priceRaw);
  if (!priceRaw) {
    errors.price = 'Ingresá el precio unitario.';
  } else if (!Number.isFinite(priceNum) || priceNum <= 0) {
    errors.price = 'El precio debe ser un número mayor a 0.';
  }

  const description = values.descriptionProduct.trim();
  if (!description) {
    errors.descriptionProduct = 'Ingresá una descripción breve.';
  } else if (description.length > 40) {
    errors.descriptionProduct = 'La descripción no puede superar los 40 caracteres.';
  }

  if (!values.idCategory.trim()) {
    errors.idCategory = 'Seleccioná una categoría.';
  }

  if (!values.idFranchise.trim()) {
    errors.idFranchise = 'Seleccioná una franquicia.';
  }

  const materialResult = resolveMaterialInput(values.materialSelect, values.materialCustom);
  if (materialResult.error) {
    errors.materialCustom = materialResult.error;
  }

  const dimensionFields: Array<{ key: 'height' | 'width' | 'depth'; raw: string; label: string }> = [
    { key: 'height', raw: values.height, label: 'El alto' },
    { key: 'width', raw: values.width, label: 'El ancho' },
    { key: 'depth', raw: values.depth, label: 'La profundidad' },
  ];
  for (const dim of dimensionFields) {
    const trimmed = dim.raw.trim();
    if (trimmed !== '') {
      const num = Number(trimmed);
      if (!Number.isFinite(num) || num < 0) {
        errors[dim.key] = `${dim.label} debe ser un número mayor o igual a 0.`;
      }
    }
  }

  const prodTimeRaw = values.productionTime.trim();
  if (prodTimeRaw !== '') {
    const prodTimeNum = Number(prodTimeRaw);
    if (!Number.isInteger(prodTimeNum) || prodTimeNum < 1 || prodTimeNum > 30) {
      errors.productionTime = 'Ingresá un entero entre 1 y 30 días.';
    }
  }

  if (mode === 'create') {
    const stockRaw = (values.stock ?? '').trim();
    if (stockRaw !== '') {
      const stockNum = Number(stockRaw);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        errors.stock = 'El stock inicial debe ser un entero mayor o igual a 0.';
      }
    }

    const requireImage = options.requireImageOnCreate ?? true;
    if (!values.imageFile || values.imageFile.size === 0) {
      if (requireImage) {
        errors.image = 'Seleccioná una imagen en formato .jpg o .png.';
      }
    } else if (!isSupportedImageFile(values.imageFile)) {
      errors.image = 'Solo se permiten archivos .jpg o .png.';
    }
  } else if (values.imageFile && values.imageFile.size > 0 && !isSupportedImageFile(values.imageFile)) {
    errors.image = 'Solo se permiten archivos .jpg o .png.';
  }

  return errors;
}

export function buildProductFormData(
  values: ProductFormValues,
  mode: 'create' | 'edit',
): FormData {
  const formData = new FormData();
  formData.append('nameProduct', values.nameProduct.trim());
  formData.append('price', values.price.trim());
  formData.append('descriptionProduct', values.descriptionProduct.trim());
  formData.append('idCategory', values.idCategory.trim());
  formData.append('idFranchise', values.idFranchise.trim());

  const materialResult = resolveMaterialInput(values.materialSelect, values.materialCustom);
  if (materialResult.value !== null) {
    formData.append('material', materialResult.value);
  } else if (mode === 'edit') {
    // Send '' on edit so the backend's customSanitizer coerces it to null and clears any prior material.
    formData.append('material', '');
  }

  const optionalFields: Array<[string, string]> = [
    ['height', values.height],
    ['width', values.width],
    ['depth', values.depth],
    ['finish', values.finish],
    ['productionTime', values.productionTime],
  ];

  for (const [key, rawValue] of optionalFields) {
    const trimmed = rawValue.trim();
    if (trimmed !== '' || mode === 'edit') {
      formData.append(key, trimmed);
    }
  }

  if (mode === 'create') {
    const stockTrimmed = (values.stock ?? '').trim();
    if (stockTrimmed !== '') {
      formData.append('stock', stockTrimmed);
    }
  }

  if (values.imageFile && values.imageFile.size > 0) {
    formData.append('image', values.imageFile);
  }

  return formData;
}

export function parseAdminProductId(rawId: string | null): number | null {
  if (!rawId) return null;
  const trimmed = rawId.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function resolveFieldIdForApiKey(key: string): string | null {
  return KNOWN_FORM_FIELD_IDS.has(key) ? key : null;
}
