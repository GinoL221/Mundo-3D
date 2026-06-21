import { ShoppingCart } from '../../domain/entities/ShoppingCart';

export interface ShoppingCartDTO {
  IDCart: number;
  IDUser: number;
  IDProduct: number;
  Quantity: number;
  UnitPrice: number;
  CartStatus: string;
  hasPriceDrift: boolean;
  product: {
    idProduct: number;
    nameProduct: string;
    price: number;
    image: string | null;
  };
}

export interface GetCartResult {
  items: ShoppingCartDTO[];
  total: number;
}

export function mapToShoppingCartDTO(entity: ShoppingCart): ShoppingCartDTO {
  const hasDrift = entity.product ? entity.hasPriceDrift(entity.product.price) : false;

  return {
    IDCart: entity.idCart,
    IDUser: entity.idUser,
    IDProduct: entity.idProduct,
    Quantity: entity.quantity,
    UnitPrice: entity.unitPrice,
    CartStatus: entity.status,
    hasPriceDrift: hasDrift,
    product: {
      idProduct: entity.idProduct,
      nameProduct: entity.product ? entity.product.nameProduct : 'Unknown Product',
      price: entity.product ? entity.product.price : entity.unitPrice,
      image: entity.product ? entity.product.image : null,
    },
  };
}
