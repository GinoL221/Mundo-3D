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
    IDProduct: number;
    NameProduct: string;
    Price: number;
    Image: string | null;
  };
}

export interface GetCartResult {
  items: ShoppingCartDTO[];
  total: number;
}

export function mapToShoppingCartDTO(entity: ShoppingCart): ShoppingCartDTO {
  const hasDrift = entity.product ? entity.hasPriceDrift(entity.product.Price) : false;

  return {
    IDCart: entity.idCart,
    IDUser: entity.idUser,
    IDProduct: entity.idProduct,
    Quantity: entity.quantity,
    UnitPrice: entity.unitPrice,
    CartStatus: entity.status,
    hasPriceDrift: hasDrift,
    product: {
      IDProduct: entity.idProduct,
      NameProduct: entity.product ? entity.product.NameProduct : 'Unknown Product',
      Price: entity.product ? entity.product.Price : entity.unitPrice,
      Image: entity.product ? entity.product.Image : null,
    },
  };
}
