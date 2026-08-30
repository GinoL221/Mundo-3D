import { describe, expect, it } from 'vitest';
import { resolveImageUrl } from './imageUrl';

describe('resolveImageUrl', () => {
  it('returns an https URL unchanged', () => {
    expect(resolveImageUrl('https://bucket.example.com/x.png', 'products')).toBe(
      'https://bucket.example.com/x.png',
    );
  });

  it('returns an http URL unchanged', () => {
    expect(resolveImageUrl('http://bucket.example.com/x.png', 'products')).toBe(
      'http://bucket.example.com/x.png',
    );
  });

  it('matches the scheme case-insensitively', () => {
    expect(resolveImageUrl('HTTPS://bucket.example.com/x.png', 'products')).toBe(
      'HTTPS://bucket.example.com/x.png',
    );
    expect(resolveImageUrl('HtTp://bucket.example.com/x.png', 'users')).toBe(
      'HtTp://bucket.example.com/x.png',
    );
  });

  it('falls back to /img/products/<name> for a bare filename', () => {
    expect(resolveImageUrl('vase.png', 'products')).toBe('/img/products/vase.png');
  });

  it('falls back to /img/users/<name> for a bare filename', () => {
    expect(resolveImageUrl('avatar.jpg', 'users')).toBe('/img/users/avatar.jpg');
  });

  it('returns an empty string for null', () => {
    expect(resolveImageUrl(null, 'products')).toBe('');
  });

  it('returns an empty string for undefined', () => {
    expect(resolveImageUrl(undefined, 'products')).toBe('');
  });

  it('returns an empty string for an empty string', () => {
    expect(resolveImageUrl('', 'products')).toBe('');
  });

  it('returns an empty string for a whitespace-only string', () => {
    expect(resolveImageUrl('   ', 'users')).toBe('');
  });

  it('falls back to the legacy prefix for a protocol-relative URL', () => {
    expect(resolveImageUrl('//evil/x', 'products')).toBe('/img/products///evil/x');
  });

  it('falls back to the legacy prefix for a javascript: scheme', () => {
    expect(resolveImageUrl('javascript:alert(1)', 'products')).toBe(
      '/img/products/javascript:alert(1)',
    );
  });
});
