import { Category } from './Category';
import { Franchise } from './Franchise';

export const ALLOWED_MATERIALS = ['PLA', 'Resina', 'PETG', 'Flex'];
export const CUSTOM_MATERIAL_PREFIX = 'Otros: ';
export const MAX_PRODUCTION_TIME_DAYS = 30;

export class Product {
  constructor(
    public readonly idProduct: number,
    public readonly nameProduct: string,
    public readonly price: number,
    public readonly descriptionProduct: string | null,
    public readonly image: string | null,
    public readonly idCategory: number,
    public readonly idFranchise: number,
    public readonly Category?: Category,
    public readonly Franchise?: Franchise,
    public readonly material?: string | null,
    public readonly height?: number | null,
    public readonly width?: number | null,
    public readonly depth?: number | null,
    public readonly finish?: string | null,
    public readonly productionTime?: number | null,
    public readonly stock?: number | null
  ) {
    if (price <= 0.00) {
      throw new Error('Price must be greater than 0.00');
    }
    if (material !== null && material !== undefined) {
      const isAllowed =
        ALLOWED_MATERIALS.includes(material) || material.startsWith(CUSTOM_MATERIAL_PREFIX);
      if (!isAllowed) {
        throw new Error('Invalid material');
      }
    }
    if (height !== null && height !== undefined && height < 0) {
      throw new Error('Height must be greater than or equal to 0');
    }
    if (width !== null && width !== undefined && width < 0) {
      throw new Error('Width must be greater than or equal to 0');
    }
    if (depth !== null && depth !== undefined && depth < 0) {
      throw new Error('Depth must be greater than or equal to 0');
    }
    if (productionTime !== null && productionTime !== undefined) {
      if (!Number.isInteger(productionTime) || productionTime <= 0) {
        throw new Error('Production time must be a positive integer');
      }
      if (productionTime > MAX_PRODUCTION_TIME_DAYS) {
        throw new Error('Production time must not exceed 30 days');
      }
    }
    if (stock !== null && stock !== undefined) {
      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error('Stock must be a non-negative integer');
      }
    }
  }

  get IDProduct(): number {
    return this.idProduct;
  }

  get NameProduct(): string {
    return this.nameProduct;
  }

  get Price(): number {
    return this.price;
  }

  get DescriptionProduct(): string | null {
    return this.descriptionProduct;
  }

  get Image(): string | null {
    return this.image;
  }

  get IDCategory(): number {
    return this.idCategory;
  }

  get IDFranchise(): number {
    return this.idFranchise;
  }

  get Material(): string | null {
    return this.material ?? null;
  }

  get Height(): number | null {
    return this.height ?? null;
  }

  get Width(): number | null {
    return this.width ?? null;
  }

  get Depth(): number | null {
    return this.depth ?? null;
  }

  get Finish(): string | null {
    return this.finish ?? null;
  }

  get ProductionTime(): number | null {
    return this.productionTime ?? null;
  }

  get Stock(): number | null {
    return this.stock ?? null;
  }
}
