import { Category } from './Category';
import { Franchise } from './Franchise';

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
    public readonly Franchise?: Franchise
  ) {
    if (price <= 0.00) {
      throw new Error('Price must be greater than 0.00');
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
}
