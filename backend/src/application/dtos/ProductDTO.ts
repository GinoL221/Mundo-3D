export interface ProductDTO {
  idProduct: number;
  nameProduct: string;
  price: number;
  descriptionProduct: string | null;
  image: string | null;
  idCategory: number;
  idFranchise: number;
  category: string;
}
