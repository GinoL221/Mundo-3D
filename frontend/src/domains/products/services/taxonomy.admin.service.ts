import { API_URL, apiFetch, authFetch, readApiErrorMessage } from '../../../config';

export interface CategoryDTO {
  idCategory: number;
  nameCategory: string;
}

export interface FranchiseDTO {
  idFranchise: number;
  nameFranchise: string;
}

export type TaxonomyErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'NETWORK'
  | 'UNKNOWN';

export type FetchTaxonomyListResult<T> =
  | { ok: true; items: T[] }
  | { ok: false; code: TaxonomyErrorCode; message: string };

export type SaveTaxonomyItemResult<T> =
  | { ok: true; item: T }
  | { ok: false; code: TaxonomyErrorCode; message: string };

export type DeleteTaxonomyItemResult =
  | { ok: true }
  | { ok: false; code: TaxonomyErrorCode; message: string };

async function readErrorBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function mapTaxonomyError(
  res: Response,
  fallbackMessage: string,
): Promise<{ ok: false; code: TaxonomyErrorCode; message: string }> {
  const body = await readErrorBody(res);
  if (res.status === 401) {
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: 'Tu sesión expiró. Volvé a iniciar sesión para continuar.',
    };
  }
  if (res.status === 403) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Solo una cuenta ADMIN puede realizar esta acción.',
    };
  }
  if (res.status === 404) {
    return { ok: false, code: 'NOT_FOUND', message: 'El registro ya no existe.' };
  }
  if (res.status === 400) {
    return {
      ok: false,
      code: 'VALIDATION',
      message: readApiErrorMessage(body, 'Ingresá un nombre válido.'),
    };
  }
  if (res.status === 409) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: readApiErrorMessage(
        body,
        'No se puede completar la acción porque existe un conflicto o piezas asociadas.',
      ),
    };
  }
  return { ok: false, code: 'UNKNOWN', message: readApiErrorMessage(body, fallbackMessage) };
}

async function fetchList<T>(path: string, fallback: string): Promise<FetchTaxonomyListResult<T>> {
  let res: Response;
  try {
    res = await apiFetch(`${API_URL}${path}`, { method: 'GET' });
  } catch {
    return {
      ok: false,
      code: 'NETWORK',
      message: 'No pudimos conectar con el servidor. Intentá de nuevo.',
    };
  }
  if (!res.ok) return mapTaxonomyError(res, fallback);
  const items = (await res.json()) as T[];
  return { ok: true, items: Array.isArray(items) ? items : [] };
}

async function saveItem<T>(
  path: string,
  method: 'POST' | 'PUT',
  payload: Record<string, string>,
  fallback: string,
): Promise<SaveTaxonomyItemResult<T>> {
  let res: Response;
  try {
    res = await authFetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      ok: false,
      code: 'NETWORK',
      message: 'No pudimos conectar con el servidor. Intentá de nuevo.',
    };
  }
  if (!res.ok) return mapTaxonomyError(res, fallback);
  const item = (await res.json()) as T;
  return { ok: true, item };
}

async function removeItem(path: string, fallback: string): Promise<DeleteTaxonomyItemResult> {
  let res: Response;
  try {
    res = await authFetch(`${API_URL}${path}`, { method: 'DELETE' });
  } catch {
    return {
      ok: false,
      code: 'NETWORK',
      message: 'No pudimos conectar con el servidor. Intentá de nuevo.',
    };
  }
  if (!res.ok) return mapTaxonomyError(res, fallback);
  return { ok: true };
}

export function fetchCategories(): Promise<FetchTaxonomyListResult<CategoryDTO>> {
  return fetchList<CategoryDTO>('/api/categories', 'No pudimos cargar las categorías.');
}

export function createCategory(nameCategory: string): Promise<SaveTaxonomyItemResult<CategoryDTO>> {
  return saveItem<CategoryDTO>(
    '/api/categories',
    'POST',
    { nameCategory },
    'No pudimos crear la categoría.',
  );
}

export function updateCategory(
  idCategory: number,
  nameCategory: string,
): Promise<SaveTaxonomyItemResult<CategoryDTO>> {
  return saveItem<CategoryDTO>(
    `/api/categories/${idCategory}`,
    'PUT',
    { nameCategory },
    'No pudimos actualizar la categoría.',
  );
}

export function deleteCategory(idCategory: number): Promise<DeleteTaxonomyItemResult> {
  return removeItem(`/api/categories/${idCategory}`, 'No pudimos eliminar la categoría.');
}

export function fetchFranchises(): Promise<FetchTaxonomyListResult<FranchiseDTO>> {
  return fetchList<FranchiseDTO>('/api/franchises', 'No pudimos cargar las franquicias.');
}

export function createFranchise(
  nameFranchise: string,
): Promise<SaveTaxonomyItemResult<FranchiseDTO>> {
  return saveItem<FranchiseDTO>(
    '/api/franchises',
    'POST',
    { nameFranchise },
    'No pudimos crear la franquicia.',
  );
}

export function updateFranchise(
  idFranchise: number,
  nameFranchise: string,
): Promise<SaveTaxonomyItemResult<FranchiseDTO>> {
  return saveItem<FranchiseDTO>(
    `/api/franchises/${idFranchise}`,
    'PUT',
    { nameFranchise },
    'No pudimos actualizar la franquicia.',
  );
}

export function deleteFranchise(idFranchise: number): Promise<DeleteTaxonomyItemResult> {
  return removeItem(`/api/franchises/${idFranchise}`, 'No pudimos eliminar la franquicia.');
}
