import { CryptoRandomIdGenerator } from '../CryptoRandomIdGenerator';

describe('CryptoRandomIdGenerator', () => {
  it('generates a well-formed UUID string', () => {
    const generator = new CryptoRandomIdGenerator();
    const id = generator.generate();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('generates a DIFFERENT id on each call, proving it is not a hardcoded constant', () => {
    const generator = new CryptoRandomIdGenerator();

    expect(generator.generate()).not.toBe(generator.generate());
  });
});
