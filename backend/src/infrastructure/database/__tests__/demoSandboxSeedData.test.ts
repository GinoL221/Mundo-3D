import { Role } from '../../../domain/Role';
import {
  buildDemoSandboxSeedData,
  buildDemoSandboxSlotEmails,
  DEMO_SANDBOX_EXPECTED_COUNTS,
  DEMO_SANDBOX_SEED_VERSION,
} from '../demoSandboxSeedData';

describe('demoSandboxSeedData', () => {
  it('builds deterministic catalog and slot-scoped USER/STAFF accounts without ADMIN', () => {
    const seed = buildDemoSandboxSeedData('slot-1');

    expect(DEMO_SANDBOX_SEED_VERSION).toBeTruthy();
    expect(seed.categories).toHaveLength(DEMO_SANDBOX_EXPECTED_COUNTS.categories);
    expect(seed.franchises).toHaveLength(DEMO_SANDBOX_EXPECTED_COUNTS.franchises);
    expect(seed.products).toHaveLength(DEMO_SANDBOX_EXPECTED_COUNTS.products);
    expect(seed.users).toHaveLength(DEMO_SANDBOX_EXPECTED_COUNTS.users);

    expect(seed.categories.map((c) => c.idCategory)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(seed.franchises.map((f) => f.idFranchise)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(seed.products.map((p) => p.idProduct)).toEqual(
      Array.from({ length: 17 }, (_, index) => index + 1),
    );
    expect(seed.products.every((p) => p.stock > 0)).toBe(true);

    const roles = seed.users.map((u) => u.idRole);
    expect(roles).toEqual([Role.USER, Role.STAFF]);
    expect(roles).not.toContain(Role.ADMIN);
    expect(seed.users.every((u) => u.email.endsWith('@sandbox.mundo3d.invalid'))).toBe(true);
    expect(seed.users.every((u) => u.emailVerifiedAt instanceof Date)).toBe(true);
    expect(seed.users.every((u) => u.passwordUser.startsWith('$2'))).toBe(true);
  });

  it('scopes synthetic emails per slot and rejects invalid slot ids', () => {
    const slot1 = buildDemoSandboxSlotEmails('Slot-A');
    const slot2 = buildDemoSandboxSlotEmails('slot-b');

    expect(slot1.buyer).toBe('demo.buyer+slot-a@sandbox.mundo3d.invalid');
    expect(slot1.staff).toBe('demo.staff+slot-a@sandbox.mundo3d.invalid');
    expect(slot1.buyer).not.toBe(slot2.buyer);

    for (const invalid of ['', '   ', 'slot 1', 'slot/1', 'a'.repeat(65)]) {
      expect(() => buildDemoSandboxSlotEmails(invalid)).toThrow('Invalid demo sandbox slot id');
    }
  });

  it('returns fresh defensive copies on repeated calls without mutating cached catalog data', () => {
    const first = buildDemoSandboxSeedData('slot-1');
    first.products[0].nameProduct = 'Mutated';
    const second = buildDemoSandboxSeedData('slot-1');
    expect(second.products[0].nameProduct).not.toBe('Mutated');
  });
});
