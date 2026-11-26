import { Role } from '../../../domain/Role';
import {
  buildDemoSandboxSeedData,
  buildDemoSandboxSlotEmails,
  DEMO_SANDBOX_EXPECTED_COUNTS,
  DEMO_SANDBOX_SEED_VERSION,
} from '../demoSandboxSeedData';

describe('demoSandboxSeedData', () => {
  it('builds deterministic catalog and slot-scoped USER/STAFF/ADMIN synthetic accounts', () => {
    const seed = buildDemoSandboxSeedData('slot-1');

    expect(DEMO_SANDBOX_SEED_VERSION).toBeTruthy();
    expect(seed.categories).toHaveLength(DEMO_SANDBOX_EXPECTED_COUNTS.categories);
    expect(seed.franchises).toHaveLength(DEMO_SANDBOX_EXPECTED_COUNTS.franchises);
    expect(seed.products).toHaveLength(DEMO_SANDBOX_EXPECTED_COUNTS.products);
    expect(seed.users).toHaveLength(DEMO_SANDBOX_EXPECTED_COUNTS.users);
    expect(seed.orders).toHaveLength(DEMO_SANDBOX_EXPECTED_COUNTS.orders);
    expect(seed.orderItems).toHaveLength(DEMO_SANDBOX_EXPECTED_COUNTS.orderItems);
    expect(seed.orders[0]).toMatchObject({
      idOrder: 1,
      idUser: 1,
      idempotencyKey: 'demo-seed-order-1',
      orderStatus: 'AWAITING_PAYMENT',
    });
    expect(seed.orderItems.every((item) => item.idOrder === 1 && item.quantity > 0)).toBe(true);

    expect(seed.categories.map((c) => c.idCategory)).toEqual(
      Array.from({ length: DEMO_SANDBOX_EXPECTED_COUNTS.categories }, (_, index) => index + 1),
    );
    expect(seed.franchises.map((f) => f.idFranchise)).toEqual(
      Array.from({ length: DEMO_SANDBOX_EXPECTED_COUNTS.franchises }, (_, index) => index + 1),
    );
    expect(seed.products.map((p) => p.idProduct)).toEqual(
      Array.from({ length: DEMO_SANDBOX_EXPECTED_COUNTS.products }, (_, index) => index + 1),
    );
    expect(seed.products.every((p) => p.stock > 0)).toBe(true);
    expect(
      seed.products.every(
        (p) => p.idCategory >= 1 && p.idCategory <= DEMO_SANDBOX_EXPECTED_COUNTS.categories,
      ),
    ).toBe(true);
    expect(
      seed.products.every(
        (p) => p.idFranchise >= 1 && p.idFranchise <= DEMO_SANDBOX_EXPECTED_COUNTS.franchises,
      ),
    ).toBe(true);

    const roles = seed.users.map((u) => u.idRole);
    expect(roles).toEqual([Role.USER, Role.STAFF, Role.ADMIN]);
    expect(seed.users.every((u) => u.email.endsWith('@sandbox.mundo3d.invalid'))).toBe(true);
    expect(seed.users.every((u) => u.emailVerifiedAt instanceof Date)).toBe(true);
    expect(seed.users.every((u) => u.passwordUser.startsWith('$2'))).toBe(true);
  });

  it('scopes synthetic emails per slot and rejects invalid slot ids', () => {
    const slot1 = buildDemoSandboxSlotEmails('Slot-A');
    const slot2 = buildDemoSandboxSlotEmails('slot-b');

    expect(slot1.buyer).toBe('demo.buyer+slot-a@sandbox.mundo3d.invalid');
    expect(slot1.staff).toBe('demo.staff+slot-a@sandbox.mundo3d.invalid');
    expect(slot1.admin).toBe('demo.admin+slot-a@sandbox.mundo3d.invalid');
    expect(slot1.buyer).not.toBe(slot2.buyer);
    expect(slot1.admin).not.toBe(slot2.admin);

    for (const invalid of ['', '   ', 'slot 1', 'slot/1', 'a'.repeat(65)]) {
      expect(() => buildDemoSandboxSlotEmails(invalid)).toThrow('Invalid demo sandbox slot id');
    }
    expect(() => buildDemoSandboxSeedData('slot-1', new Date('invalid'))).toThrow(
      'Invalid demo sandbox verification timestamp',
    );
  });

  it('returns fresh defensive copies on repeated calls without mutating cached catalog data', () => {
    const first = buildDemoSandboxSeedData('slot-1');
    first.products[0].nameProduct = 'Mutated';
    const second = buildDemoSandboxSeedData('slot-1');
    expect(second.products[0].nameProduct).not.toBe('Mutated');
  });
});
