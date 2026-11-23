import { describe, expect, it } from 'vitest';
import { formatPrice } from './price';

describe('formatPrice', () => {
  it('formats integer amounts using es-AR thousands separators with a "$ " prefix', () => {
    expect(formatPrice(0)).toBe('$ 0');
    expect(formatPrice(800)).toBe('$ 800');
    expect(formatPrice(3800)).toBe('$ 3.800');
    expect(formatPrice(125000)).toBe('$ 125.000');
  });

  it('formats decimal amounts using es-AR decimal comma without forcing trailing zeros', () => {
    expect(formatPrice(1499.5)).toBe('$ 1.499,5');
    expect(formatPrice(1500.0)).toBe('$ 1.500');
  });
});
