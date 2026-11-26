import { AdjustProductStockUseCase as AdjStock } from '../../application/use-cases/AdjustProductStockUseCase';
import { CancelOrderUseCase as CancelOrd } from '../../application/use-cases/CancelOrderUseCase';
import { ConfirmOrderPaymentUseCase as ConfirmOrd } from '../../application/use-cases/ConfirmOrderPaymentUseCase';
import { CreateCategoryUseCase as CreateCat } from '../../application/use-cases/CreateCategoryUseCase';
import { CreateCustomCommissionRequestUseCase as CreateComm } from '../../application/use-cases/CreateCustomCommissionRequestUseCase';
import { CreateFranchiseUseCase as CreateFran } from '../../application/use-cases/CreateFranchiseUseCase';
import { CreateOrderUseCase as CreateOrd } from '../../application/use-cases/CreateOrderUseCase';
import { CreateProductUseCase as CreateProd } from '../../application/use-cases/CreateProductUseCase';
import { DeleteCategoryUseCase as DeleteCat } from '../../application/use-cases/DeleteCategoryUseCase';
import { DeleteFranchiseUseCase as DeleteFran } from '../../application/use-cases/DeleteFranchiseUseCase';
import { DeleteProductUseCase as DeleteProd } from '../../application/use-cases/DeleteProductUseCase';
import { GetCartByUserIdUseCase as GetCart } from '../../application/use-cases/GetCartByUserIdUseCase';
import { GetCategoryByIdUseCase as GetCat } from '../../application/use-cases/GetCategoryByIdUseCase';
import { GetFranchiseByIdUseCase as GetFran } from '../../application/use-cases/GetFranchiseByIdUseCase';
import { GetLatestProductUseCase as GetLat } from '../../application/use-cases/GetLatestProductUseCase';
import { GetOrderByIdUseCase as GetOrd } from '../../application/use-cases/GetOrderByIdUseCase';
import { GetProductByIdUseCase as GetProd } from '../../application/use-cases/GetProductByIdUseCase';
import { GetUserByIdUseCase as GetUsr } from '../../application/use-cases/GetUserByIdUseCase';
import { ListCategoriesUseCase as ListCat } from '../../application/use-cases/ListCategoriesUseCase';
import { ListCustomCommissionRequestsUseCase as ListComm } from '../../application/use-cases/ListCustomCommissionRequestsUseCase';
import { ListFranchisesUseCase as ListFran } from '../../application/use-cases/ListFranchisesUseCase';
import { ListMyOrdersUseCase as ListMyOrd } from '../../application/use-cases/ListMyOrdersUseCase';
import { ListOrdersUseCase as ListOrd } from '../../application/use-cases/ListOrdersUseCase';
import { ListProductsUseCase as ListProd } from '../../application/use-cases/ListProductsUseCase';
import { ListUsersUseCase as ListUsr } from '../../application/use-cases/ListUsersUseCase';
import { SearchProductsUseCase as SearchProd } from '../../application/use-cases/SearchProductsUseCase';
import { SyncCartUseCase as SyncCart } from '../../application/use-cases/SyncCartUseCase';
import { UpdateCategoryUseCase as UpdateCat } from '../../application/use-cases/UpdateCategoryUseCase';
import { UpdateFranchiseUseCase as UpdateFran } from '../../application/use-cases/UpdateFranchiseUseCase';
import { UpdateProductUseCase as UpdateProd } from '../../application/use-cases/UpdateProductUseCase';
import type { DemoSandboxProductRepositories as Repos } from '../database/DemoSandboxProductRepositories';
import { PinoLogger } from '../logging/PinoLogger';
import { ManualPaymentGateway } from '../payments/ManualPaymentGateway';
import { CartApiController } from './CartApiController';
import { CategoryApiController } from './CategoryApiController';
import { CustomCommissionRequestApiController } from './CustomCommissionRequestApiController';
import { FranchiseApiController } from './FranchiseApiController';
import { OrderApiController } from './OrderApiController';
import { ProductApiController } from './ProductApiController';
import { UserApiController } from './UserApiController';

export interface DemoSandboxBuyerControllers {
  products: Pick<
    ProductApiController,
    'index' | 'show' | 'latest' | 'search' | 'create' | 'update' | 'destroy' | 'adjustStock'
  >;
  categories: Pick<CategoryApiController, 'index' | 'show' | 'create' | 'update' | 'destroy'>;
  franchises: Pick<FranchiseApiController, 'index' | 'show' | 'create' | 'update' | 'destroy'>;
  cart: Pick<CartApiController, 'getCart' | 'syncCart'>;
  orders: Pick<
    OrderApiController,
    'create' | 'show' | 'index' | 'confirmPayment' | 'cancel' | 'listMine'
  >;
  commissions: Pick<CustomCommissionRequestApiController, 'create' | 'list'>;
  users: Pick<UserApiController, 'index' | 'show' | 'me'>;
}

const cache = new WeakMap<Repos, Map<string, DemoSandboxBuyerControllers>>();
const [log, pay, off] = [new PinoLogger(), new ManualPaymentGateway(), undefined as never];

function build(r: Repos, id: string): DemoSandboxBuyerControllers {
  const [p, c, f] = [r.get(id), r.getCategoryRepository(id), r.getFranchiseRepository(id)];
  const [cart, ord, usr] = [
    r.getShoppingCartRepository(id),
    r.getOrderRepository(id),
    r.getUserRepository(id),
  ];
  const [comm, uow] = [r.getCustomCommissionRequestRepository(id), r.getUnitOfWork(id)];
  const pr = new ProductApiController(
    new ListProd(p),
    new GetProd(p),
    new GetLat(p),
    new CreateProd(p, c),
    new UpdateProd(p, c),
    new DeleteProd(p),
    new AdjStock(p, log),
    new SearchProd(p),
  );
  const ca = new CategoryApiController(
    new ListCat(c),
    new GetCat(c),
    new CreateCat(c),
    new UpdateCat(c),
    new DeleteCat(c),
  );
  const fr = new FranchiseApiController(
    new ListFran(f),
    new GetFran(f),
    new CreateFran(f),
    new UpdateFran(f),
    new DeleteFran(f),
  );
  const ct = new CartApiController(new GetCart(cart), new SyncCart(cart, p));
  const or = new OrderApiController(
    new CreateOrd(uow, ord, cart, p, pay, log),
    new GetOrd(ord),
    new ListOrd(ord, usr),
    new ConfirmOrd(ord),
    new CancelOrd(uow, ord, p),
    new ListMyOrd(ord),
  );
  const cm = new CustomCommissionRequestApiController(
    new CreateComm(comm, undefined, p),
    new ListComm(comm),
  );
  const us = new UserApiController(off, new ListUsr(usr), new GetUsr(usr));
  return {
    products: {
      index: pr.index,
      show: pr.show,
      latest: pr.latest,
      search: pr.search,
      create: pr.create,
      update: pr.update,
      destroy: pr.destroy,
      adjustStock: pr.adjustStock,
    },
    categories: {
      index: ca.index,
      show: ca.show,
      create: ca.create,
      update: ca.update,
      destroy: ca.destroy,
    },
    franchises: {
      index: fr.index,
      show: fr.show,
      create: fr.create,
      update: fr.update,
      destroy: fr.destroy,
    },
    cart: { getCart: ct.getCart, syncCart: ct.syncCart },
    orders: {
      create: or.create,
      show: or.show,
      index: or.index,
      confirmPayment: or.confirmPayment,
      cancel: or.cancel,
      listMine: or.listMine,
    },
    commissions: { create: cm.create, list: cm.list },
    users: { index: us.index, show: us.show, me: us.me },
  };
}

export function createDemoSandboxBuyerControllers(
  repositories: Repos,
  slotId: string,
): DemoSandboxBuyerControllers {
  const bySlot = cache.get(repositories) ?? new Map<string, DemoSandboxBuyerControllers>();
  cache.set(repositories, bySlot);
  const hit = bySlot.get(slotId) ?? build(repositories, slotId);
  bySlot.set(slotId, hit);
  return hit;
}
