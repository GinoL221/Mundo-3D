export interface ProductDTO {
  IDProduct: number;
  NameProduct: string;
  Price: number;
  DescriptionProduct: string | null;
  Image: string | null;
  idCategory: number;
  idFranchise: number;
  Category: string;
}
