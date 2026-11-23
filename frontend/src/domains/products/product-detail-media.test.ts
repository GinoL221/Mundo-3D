import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const ruleBody = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`))?.[1] ?? '';
};

describe('product detail media', () => {
  const styles = source('../../styles/components/product-detail.css');
  const page = source('../../pages/product.astro');

  it('fills a square frame with real product photos', () => {
    const image = ruleBody(styles, '.product-detail__image');

    expect(image).toContain('aspect-ratio: 1 / 1;');
    expect(image).toContain('object-fit: cover;');
    expect(image).not.toContain('max-height');
    expect(image).not.toContain('padding');
  });

  it('keeps category illustrations uncropped with breathing room', () => {
    const placeholder = ruleBody(styles, '.product-detail__image--placeholder');

    expect(placeholder).toContain('object-fit: contain;');
    expect(placeholder).toContain('padding: var(--space-xl);');
  });

  it('toggles the placeholder modifier for illustrations and failed photo loads', () => {
    expect(page).toContain(
      "imageElement.classList.toggle('product-detail__image--placeholder', placeholder);",
    );
    expect(page).toContain("imageElement.classList.add('product-detail__image--placeholder');");
  });
});
