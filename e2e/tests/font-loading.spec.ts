import { createHash } from 'node:crypto';
import { expect, test, type Browser } from '@playwright/test';

const fontAssets = [
  {
    path: '/fonts/ibm-plex-sans/ibm-plex-sans-latin.woff2',
    sha256: 'e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470',
  },
  {
    path: '/fonts/ibm-plex-sans/ibm-plex-sans-latin-ext.woff2',
    sha256: 'd160e20920ae4d6556518d352d3af27a74e9b0de3d8fe17b1c1044fc75aa2f81',
  },
] as const;

const spanishSample = 'Mundo 3D: comisión, diseño, niño, €';

async function blockGoogleFonts(browser: Browser) {
  const context = await browser.newContext();
  const attemptedFonts: string[] = [];
  await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, async (route) => {
    attemptedFonts.push(route.request().url());
    await route.abort();
  });
  return { context, attemptedFonts };
}

test.describe('self-hosted IBM Plex Sans', () => {
  test('loads local latin subsets and all incumbent weights without Google Fonts', async ({ browser }) => {
    const { context, attemptedFonts } = await blockGoogleFonts(browser);
    const page = await context.newPage();
    try {
      await page.goto('http://localhost:4322/', { waitUntil: 'domcontentloaded' });
      const loaded = await page.evaluate(async (sample) => {
        await document.fonts.ready;
        const results = await Promise.all([400, 500, 600].map(async (weight) => {
          const faces = await document.fonts.load(`${weight} 16px "IBM Plex Sans"`, sample);
          return { weight, faces: faces.map((face) => ({ family: face.family, status: face.status })) };
        }));
        return results;
      }, spanishSample);

      expect(attemptedFonts).toEqual([]);
      for (const entry of loaded) {
        expect(entry.faces.length, `weight ${entry.weight} should resolve to a real face`).toBeGreaterThan(0);
        expect(entry.faces.every((face) => face.status === 'loaded')).toBe(true);
      }

      for (const asset of fontAssets) {
        const response = await page.request.get(`http://localhost:4322${asset.path}`);
        expect(response.ok()).toBe(true);
        expect(response.headers()['content-type']).toMatch(/font\/woff2/i);
        const bytes = await response.body();
        expect(bytes.subarray(0, 4).toString('ascii')).toBe('wOF2');
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
      }
    } finally {
      await context.close();
    }
  });

  test('rejects local font loading when local font requests fail instead of accepting fallback', async ({ browser }) => {
    const { context, attemptedFonts } = await blockGoogleFonts(browser);
    await context.route('**/fonts/ibm-plex-sans/*.woff2', (route) => route.abort());
    const page = await context.newPage();
    try {
      await page.goto('http://localhost:4322/', { waitUntil: 'domcontentloaded' });
      const result = await page.evaluate(async (sample) => {
        const outcomes = await Promise.all([400, 500, 600].map(async (weight) => {
          try {
            const faces = await document.fonts.load(`${weight} 16px "IBM Plex Sans"`, sample);
            return { rejected: false, count: faces.length };
          } catch {
            return { rejected: true, count: 0 };
          }
        }));
        return outcomes;
      }, spanishSample);

      expect(attemptedFonts).toEqual([]);
      expect(result.every((outcome) => outcome.rejected)).toBe(true);
    } finally {
      await context.close();
    }
  });
});
