import { readPositiveInt } from '../readPositiveInt';

describe('readPositiveInt', () => {
  it('parses valid positive integer strings', () => {
    expect(readPositiveInt('1', 10)).toBe(1);
    expect(readPositiveInt('100', 10)).toBe(100);
    expect(readPositiveInt('1000', 10)).toBe(1000);
  });

  it('falls back when raw value is undefined, empty, or whitespace', () => {
    expect(readPositiveInt(undefined, 42)).toBe(42);
    expect(readPositiveInt('', 42)).toBe(42);
    expect(readPositiveInt('   ', 42)).toBe(42);
  });

  it('falls back when raw value is not a valid number (preventing NaN bypasses)', () => {
    expect(readPositiveInt('not-a-number', 5)).toBe(5);
    expect(readPositiveInt('NaN', 5)).toBe(5);
    expect(readPositiveInt('abc', 5)).toBe(5);
    expect(readPositiveInt('123abc', 5)).toBe(5);
  });

  it('falls back when raw value is zero or negative', () => {
    expect(readPositiveInt('0', 15)).toBe(15);
    expect(readPositiveInt('-1', 15)).toBe(15);
    expect(readPositiveInt('-100', 15)).toBe(15);
  });

  it('falls back when raw value is a float/decimal', () => {
    expect(readPositiveInt('10.5', 20)).toBe(20);
    expect(readPositiveInt('0.1', 20)).toBe(20);
  });
});
