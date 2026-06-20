import router from '../cart';

describe('api/cart routes', () => {
  it('should register GET /cart route', () => {
    const routes = router.stack.filter((s: any) => s.route?.path === '/cart');
    const getRoute = routes.find((r: any) => r.route?.methods?.get === true);
    expect(getRoute).toBeDefined();
  });

  it('should register PUT /cart route', () => {
    const routes = router.stack.filter((s: any) => s.route?.path === '/cart');
    const putRoute = routes.find((r: any) => r.route?.methods?.put === true);
    expect(putRoute).toBeDefined();
  });

  it('should have auth middleware and controller method registered on routes', () => {
    const routes = router.stack.filter((s: any) => s.route?.path === '/cart');
    routes.forEach((r: any) => {
      expect(r.route?.stack.length).toBeGreaterThanOrEqual(2);
    });
  });
});
