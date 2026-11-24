import { CreateCustomCommissionRequestUseCase as CreateComm } from '../../application/use-cases/CreateCustomCommissionRequestUseCase';
import { CreateOrderUseCase as CreateOrd } from '../../application/use-cases/CreateOrderUseCase';
import { GetCartByUserIdUseCase as GetCart } from '../../application/use-cases/GetCartByUserIdUseCase';
import { GetCategoryByIdUseCase as GetCat } from '../../application/use-cases/GetCategoryByIdUseCase';
import { GetFranchiseByIdUseCase as GetFran } from '../../application/use-cases/GetFranchiseByIdUseCase';
import { GetLatestProductUseCase as GetLat } from '../../application/use-cases/GetLatestProductUseCase';
import { GetOrderByIdUseCase as GetOrd } from '../../application/use-cases/GetOrderByIdUseCase';
import { GetProductByIdUseCase as GetProd } from '../../application/use-cases/GetProductByIdUseCase';
import { ListCategoriesUseCase as ListCat } from '../../application/use-cases/ListCategoriesUseCase';
import { ListFranchisesUseCase as ListFran } from '../../application/use-cases/ListFranchisesUseCase';
import { ListMyOrdersUseCase as ListMyOrd } from '../../application/use-cases/ListMyOrdersUseCase';
import { ListProductsUseCase as ListProd } from '../../application/use-cases/ListProductsUseCase';
import { SearchProductsUseCase as SearchProd } from '../../application/use-cases/SearchProductsUseCase';
import { SyncCartUseCase as SyncCart } from '../../application/use-cases/SyncCartUseCase';
import type { DemoSandboxProductRepositories as Repos } from '../database/DemoSandboxProductRepositories';
import { PinoLogger } from '../logging/PinoLogger';
import { ManualPaymentGateway } from '../payments/ManualPaymentGateway';
import { CartApiController } from './CartApiController';
import { CategoryApiController } from './CategoryApiController';
import { CustomCommissionRequestApiController } from './CustomCommissionRequestApiController';
import { FranchiseApiController } from './FranchiseApiController';
import { OrderApiController } from './OrderApiController';
import { ProductApiController } from './ProductApiController';

export interface DemoSandboxBuyerControllers {
  products: Pick<ProductApiController, 'index' | 'show' | 'latest' | 'search'>;
  categories: Pick<CategoryApiController, 'index' | 'show'>;
  franchises: Pick<FranchiseApiController, 'index' | 'show'>;
  cart: Pick<CartApiController, 'getCart' | 'syncCart'>;
  orders: Pick<OrderApiController, 'create' | 'show' | 'listMine'>;
  commissions: Pick<CustomCommissionRequestApiController, 'create'>;
}

const cache = new WeakMap<Repos, Map<string, DemoSandboxBuyerControllers>>();
const [log, pay, off] = [new PinoLogger(), new ManualPaymentGateway(), undefined as never];

function build(r: Repos, id: string): DemoSandboxBuyerControllers {
  const [p, c, f] = [r.get(id), r.getCategoryRepository(id), r.getFranchiseRepository(id)];
  const [cart, ord] = [r.getShoppingCartRepository(id), r.getOrderRepository(id)];
  const [comm, uow] = [r.getCustomCommissionRequestRepository(id), r.getUnitOfWork(id)];
  const pr = new ProductApiController(
    new ListProd(p),
    new GetProd(p),
    new GetLat(p),
    off,
    off,
    off,
    off,
    new SearchProd(p),
  );
  const ca = new CategoryApiController(new ListCat(c), new GetCat(c), off, off, off);
  const fr = new FranchiseApiController(new ListFran(f), new GetFran(f), off, off, off);
  const ct = new CartApiController(new GetCart(cart), new SyncCart(cart, p));
  const or = new OrderApiController(
    new CreateOrd(uow, ord, cart, p, pay, log),
    new GetOrd(ord),
    off,
    off,
    off,
    new ListMyOrd(ord),
  );
  const cm = new CustomCommissionRequestApiController(new CreateComm(comm, undefined, p), off);
  return {
    products: { index: pr.index, show: pr.show, latest: pr.latest, search: pr.search },
    categories: { index: ca.index, show: ca.show },
    franchises: { index: fr.index, show: fr.show },
    cart: { getCart: ct.getCart, syncCart: ct.syncCart },
    orders: { create: or.create, show: or.show, listMine: or.listMine },
    commissions: { create: cm.create },
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
