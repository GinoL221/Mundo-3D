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
  hasDimensions: boolean;
  finish: string;
  productionTime: string;
}

export const CATEGORY_IMAGES: Record<string, string> = {
  Figura: 'Figura',
  Busto: 'Busto',
  Llavero: 'Llavero',
  Máscara: 'Mascara',
  Otras: 'Otras',
};

export function getCategoryImg(categoryName: string): string {
  return CATEGORY_IMAGES[categoryName] || 'Otras';
}

export function isPlaceholderImage(imageFilename: string | null | undefined): boolean {
  return !imageFilename || imageFilename === 'productoSinImagen.png' || imageFilename === 'productoSinImagen.svg';
}

function formatDimensions(
  height?: number | null,
  width?: number | null,
  depth?: number | null,
): { height: string; width: string; depth: string; hasDimensions: boolean } {
  const hasAnyDimension = height != null || width != null || depth != null;

  if (!hasAnyDimension) {
    return { height: 'A consultar', width: 'A consultar', depth: 'A consultar', hasDimensions: false };
  }

  return {
    height: height != null ? `${height} cm` : 'no definida',
    width: width != null ? `${width} cm` : 'no definida',
    depth: depth != null ? `${depth} cm` : 'no definida',
    hasDimensions: true,
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
    hasDimensions: dimensions.hasDimensions,
    finish: apiProduct.finish || 'A consultar',
    productionTime: apiProduct.productionTime ? `${apiProduct.productionTime} días` : 'A consultar',
  };
}

export function adaptAPIProducts(apiProducts: APIProduct[]): Product[] {
  return apiProducts.map(adaptAPIProduct);
}
