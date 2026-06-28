import { ShoppingCart } from '../../domain/entities/ShoppingCart';

export interface ShoppingCartDTO {
  idCart: number;
  idUser: number;
  idProduct: number;
  quantity: number;
  unitPrice: number;
  status: string;
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
    idCart: entity.idCart,
    idUser: entity.idUser,
    idProduct: entity.idProduct,
    quantity: entity.quantity,
    unitPrice: entity.unitPrice,
    status: entity.status,
    hasPriceDrift: hasDrift,
    product: {
      idProduct: entity.idProduct,
      nameProduct: entity.product ? entity.product.nameProduct : 'Unknown Product',
      price: entity.product ? entity.product.price : entity.unitPrice,
      image: entity.product ? entity.product.image : null,
    },
  };
}
