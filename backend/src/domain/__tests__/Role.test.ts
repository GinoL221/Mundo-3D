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
});
