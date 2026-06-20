import { Category } from './Category';
import { Franchise } from './Franchise';

export class Product {
  constructor(
    public readonly IDProduct: number,
    public readonly NameProduct: string,
    public readonly Price: number,
    public readonly DescriptionProduct: string | null,
    public readonly Image: string | null,
    public readonly idCategory: number,
    public readonly idFranchise: number,
    public readonly Category?: Category,
    public readonly Franchise?: Franchise
  ) {}
}
