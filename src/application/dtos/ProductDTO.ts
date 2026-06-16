export interface ProductDTO {
  IDProduct: number;
  NameProduct: string;
  Price: number;
  DescriptionProduct: string | null;
  Image: string | null;
  IDCategory: number;
  IDFranchise: number;
  Category: string;
}
