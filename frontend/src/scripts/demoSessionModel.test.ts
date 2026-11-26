import { describe, expect, it } from 'vitest';
import { buildDemoBarPresentation, buildDemoNotice, isDemoProtectedPath } from './demoSessionModel';

describe('demoSessionModel', () => {
  it('maps USER and STAFF roles to Taller Maker badges and rioplatense copy', () => {
    expect(buildDemoBarPresentation('USER')).toEqual({
      roleLabel: 'BUYER',
      roleBadgeClass: 'ui-badge ui-badge--user',
      summaryText: 'Sesión temporal aislada · los cambios se reinician al salir.',
    });
    expect(buildDemoBarPresentation('STAFF')).toEqual({
      roleLabel: 'STAFF',
      roleBadgeClass: 'ui-badge ui-badge--staff',
      summaryText:
        'Sesión aislada · podés ver pedidos, ajustar stock, editar el catálogo y revisar solicitudes. Sin eliminar piezas ni tocar pagos.',
    });
  });

  it('builds honest rioplatense notices for 404 disabled, 503 busy, 429, 401 expired, and error', () => {
    const disabled = buildDemoNotice('disabled');
    expect(disabled.tone).toBe('info');
    expect(disabled.retryLabel).toBeUndefined();

    const busy = buildDemoNotice('busy', 45);
    expect(busy.tone).toBe('warning');
    expect(busy.text).toContain('45 segundos');
    expect(busy.retryLabel).toBe('Reintentar');

    const rateLimit = buildDemoNotice('rate-limit');
    expect(rateLimit.tone).toBe('warning');
    expect(rateLimit.retryLabel).toBeUndefined();

    const expired = buildDemoNotice('expired');
    expect(expired.tone).toBe('info');
    expect(expired.retryLabel).toBe('Iniciar nueva sesión demo');

    const error = buildDemoNotice('error');
    expect(error.tone).toBe('warning');
    expect(error.retryLabel).toBe('Reintentar');
  });

  it('identifies protected paths that must redirect home on demo exit', () => {
    expect(isDemoProtectedPath('/admin/products')).toBe(true);
    expect(isDemoProtectedPath('/admin/commission-requests')).toBe(true);
    expect(isDemoProtectedPath('/orders')).toBe(true);
    expect(isDemoProtectedPath('/order')).toBe(true);
    expect(isDemoProtectedPath('/profile')).toBe(true);
    expect(isDemoProtectedPath('/products')).toBe(false);
    expect(isDemoProtectedPath('/')).toBe(false);
  });
});
