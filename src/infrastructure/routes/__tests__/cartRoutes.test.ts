import router from '../cartRoutes';

describe('cartRoutes', () => {
  it('should register GET /productCart route', () => {
    const route = router.stack.find((s: any) => s.route?.path === '/productCart');
    expect(route).toBeDefined();
    expect((route?.route as any)?.methods?.get).toBe(true);
  });

  it('should have middleware and controller registered on /productCart', () => {
    const route = router.stack.find((s: any) => s.route?.path === '/productCart');
    expect(route?.route?.stack).toHaveLength(2); // auth middleware + controller method
  });
});
