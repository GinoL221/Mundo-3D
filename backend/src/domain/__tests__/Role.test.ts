import { Role } from '../Role';

describe('Role', () => {
  it('exports ADMIN === 1', () => {
    expect(Role.ADMIN).toBe(1);
  });

  it('exports USER === 2', () => {
    expect(Role.USER).toBe(2);
  });

  it('ADMIN and USER are distinct values', () => {
    expect(Role.ADMIN).not.toBe(Role.USER);
  });

  it('exports STAFF === 3', () => {
    expect(Role.STAFF).toBe(3);
  });

  it('ADMIN, USER, and STAFF are all distinct values', () => {
    const values = [Role.ADMIN, Role.USER, Role.STAFF];
    expect(new Set(values).size).toBe(3);
  });
});
