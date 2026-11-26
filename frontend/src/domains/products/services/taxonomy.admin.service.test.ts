import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCategory,
  createFranchise,
  deleteCategory,
  deleteFranchise,
  fetchCategories,
  fetchFranchises,
  updateCategory,
  updateFranchise,
} from './taxonomy.admin.service';

function jsonResponse(status: number, body: unknown): Response {
  if (status === 204) {
    return new Response(null, { status });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('taxonomy.admin.service', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('document', { cookie: 'm3d_csrf=tok.hmac' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists categories and franchises', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [{ idCategory: 1, nameCategory: 'Busto' }]))
      .mockResolvedValueOnce(jsonResponse(200, [{ idFranchise: 2, nameFranchise: 'Marvel' }]));

    expect(await fetchCategories()).toEqual({
      ok: true,
      items: [{ idCategory: 1, nameCategory: 'Busto' }],
    });
    expect(await fetchFranchises()).toEqual({
      ok: true,
      items: [{ idFranchise: 2, nameFranchise: 'Marvel' }],
    });
  });

  it('creates, updates, and deletes categories with CSRF credentials and maps 409 conflicts', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { idCategory: 14, nameCategory: 'Dioramas' }),
    );
    const created = await createCategory('Dioramas');
    expect(created).toEqual({ ok: true, item: { idCategory: 14, nameCategory: 'Dioramas' } });
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('X-CSRF-Token')).toBe('tok.hmac');

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { idCategory: 14, nameCategory: 'Dioramas 3D' }),
    );
    const updated = await updateCategory(14, 'Dioramas 3D');
    expect(updated).toEqual({ ok: true, item: { idCategory: 14, nameCategory: 'Dioramas 3D' } });

    fetchMock.mockResolvedValueOnce(jsonResponse(204, null));
    expect(await deleteCategory(14)).toEqual({ ok: true });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: 'La categoría tiene productos asociados' }),
    );
    expect(await deleteCategory(1)).toEqual({
      ok: false,
      code: 'CONFLICT',
      message: 'La categoría tiene productos asociados',
    });
  });

  it('creates, updates, and deletes franchises and maps 403/network errors', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { idFranchise: 15, nameFranchise: 'Studio Ghibli' }),
    );
    expect(await createFranchise('Studio Ghibli')).toEqual({
      ok: true,
      item: { idFranchise: 15, nameFranchise: 'Studio Ghibli' },
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { idFranchise: 15, nameFranchise: 'Ghibli' }),
    );
    expect(await updateFranchise(15, 'Ghibli')).toEqual({
      ok: true,
      item: { idFranchise: 15, nameFranchise: 'Ghibli' },
    });

    fetchMock.mockResolvedValueOnce(jsonResponse(403, { error: 'Acceso restringido' }));
    expect(await deleteFranchise(15)).toEqual({
      ok: false,
      code: 'FORBIDDEN',
      message: expect.any(String),
    });

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await deleteFranchise(15)).toEqual({
      ok: false,
      code: 'NETWORK',
      message: expect.any(String),
    });
  });
});
