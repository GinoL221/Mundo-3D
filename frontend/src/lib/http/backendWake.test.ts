import { describe, expect, it } from 'vitest';
import {
  BACKEND_SLEEPING_CODE,
  readBackendSleepingInfo,
  sanitizeExternalHttpUrl,
} from './backendWake';

describe('sanitizeExternalHttpUrl', () => {
  it('accepts valid https and http URLs and returns normalized href', () => {
    expect(sanitizeExternalHttpUrl('https://mundo-3d-backend.onrender.com/health/ready')).toBe(
      'https://mundo-3d-backend.onrender.com/health/ready',
    );
    expect(sanitizeExternalHttpUrl('  http://localhost:3031/health/ready  ')).toBe(
      'http://localhost:3031/health/ready',
    );
  });

  it('rejects dangerous schemes, relative paths, and non-string values', () => {
    expect(sanitizeExternalHttpUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeExternalHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeExternalHttpUrl('//evil.example/health/ready')).toBeNull();
    expect(sanitizeExternalHttpUrl('/health/ready')).toBeNull();
    expect(sanitizeExternalHttpUrl('')).toBeNull();
    expect(sanitizeExternalHttpUrl(null)).toBeNull();
    expect(sanitizeExternalHttpUrl(42)).toBeNull();
  });
});

describe('readBackendSleepingInfo', () => {
  it('extracts sanitized wakeUrl from a 503 BACKEND_SLEEPING payload', async () => {
    const res = new Response(
      JSON.stringify({
        error: 'El servidor está dormido',
        code: BACKEND_SLEEPING_CODE,
        wakeUrl: 'https://mundo-3d-backend.onrender.com/health/ready',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );

    expect(await readBackendSleepingInfo(res)).toEqual({
      wakeUrl: 'https://mundo-3d-backend.onrender.com/health/ready',
    });
  });

  it('returns null wakeUrl when payload carries an unsafe scheme', async () => {
    const res = new Response(
      JSON.stringify({
        code: BACKEND_SLEEPING_CODE,
        wakeUrl: 'javascript:alert(1)',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );

    expect(await readBackendSleepingInfo(res)).toEqual({ wakeUrl: null });
  });

  it('returns null for non-503 statuses, other 503 JSON payloads, or invalid JSON', async () => {
    expect(
      await readBackendSleepingInfo(
        new Response(JSON.stringify({ code: BACKEND_SLEEPING_CODE }), { status: 500 }),
      ),
    ).toBeNull();

    expect(
      await readBackendSleepingInfo(
        new Response(JSON.stringify({ error: 'Other 503' }), { status: 503 }),
      ),
    ).toBeNull();

    expect(
      await readBackendSleepingInfo(new Response('<html>503</html>', { status: 503 })),
    ).toBeNull();
  });
});
