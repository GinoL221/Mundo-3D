import { NormalizedEmail } from '../NormalizedEmail';

describe('NormalizedEmail', () => {
  it('trims surrounding whitespace and lowercases an email address', () => {
    expect(NormalizedEmail.from('  Customer.Name@EXAMPLE.com  ').value).toBe(
      'customer.name@example.com',
    );
  });

  it('leaves an already normalized address unchanged', () => {
    expect(NormalizedEmail.from('customer.name@example.com').value).toBe(
      'customer.name@example.com',
    );
  });
});
