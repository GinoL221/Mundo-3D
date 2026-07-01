export interface APIProduct {
  idProduct: number;
  nameProduct: string;
  price: number;
  descriptionProduct: string | null;
  image: string | null;
  category?: string;
  material?: string | null;
  height?: number | null;
  width?: number | null;
  depth?: number | null;
  finish?: string | null;
  productionTime?: number | null;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  material: string;
  height: string;
  width: string;
  depth: string;
  finish: string;
  productionTime: string;
}

function formatDimensions(
  height?: number | null,
  width?: number | null,
  depth?: number | null,
): { height: string; width: string; depth: string } {
  const hasAnyDimension = Boolean(height) || Boolean(width) || Boolean(depth);

  if (!hasAnyDimension) {
    return { height: 'A consultar', width: 'A consultar', depth: 'A consultar' };
  }

  return {
    height: height ? `${height} cm` : 'no definida',
    width: width ? `${width} cm` : 'no definida',
    depth: depth ? `${depth} cm` : 'no definida',
  };
}

export function adaptAPIProduct(apiProduct: APIProduct): Product {
  const dimensions = formatDimensions(apiProduct.height, apiProduct.width, apiProduct.depth);

  return {
    id: apiProduct.idProduct,
    name: apiProduct.nameProduct,
    price: apiProduct.price,
    description: apiProduct.descriptionProduct || '',
    image: apiProduct.image || '',
    category: apiProduct.category || 'Otras',
    material: apiProduct.material || 'A consultar',
    height: dimensions.height,
    width: dimensions.width,
    depth: dimensions.depth,
    finish: apiProduct.finish || 'A consultar',
    productionTime: apiProduct.productionTime ? `${apiProduct.productionTime} días` : 'A consultar',
  };
}

export function adaptAPIProducts(apiProducts: APIProduct[]): Product[] {
  return apiProducts.map(adaptAPIProduct);
}
