export interface APIProduct {
  idProduct: number;
  nameProduct: string;
  price: number;
  descriptionProduct: string | null;
  image: string | null;
  category?: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
}

export function adaptAPIProduct(apiProduct: APIProduct): Product {
  return {
    id: apiProduct.idProduct,
    name: apiProduct.nameProduct,
    price: apiProduct.price,
    description: apiProduct.descriptionProduct || '',
    image: apiProduct.image || '',
    category: apiProduct.category || 'Otras',
  };
}

export function adaptAPIProducts(apiProducts: APIProduct[]): Product[] {
  return apiProducts.map(adaptAPIProduct);
}
