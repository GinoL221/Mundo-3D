import { API_URL, authFetch, readApiErrorMessage } from '../../../config';

// Mirrors backend/src/application/dtos/ProductDTO.ts. This is the admin
// mutation surface — server-side validation (express-validator) is the
// source of truth; this type only shapes what the API is expected to echo
// back, it does not duplicate the validation rules.
export interface AdminProductDTO {
  idProduct: number;
  nameProduct: string;
  price: number;
  descriptionProduct: string | null;
  image: string | null;
  idCategory: number;
  idFranchise: number;
  category: string;
  material: string | null;
  height: number | null;
  width: number | null;
  depth: number | null;
  finish: string | null;
  productionTime: number | null;
  stock: number;
}

/**
 * Thrown for any non-ok response from the admin product API. Carries the
 * HTTP status so callers can branch on it (e.g. 401 → clear session and
 * redirect to /login) instead of only having an untyped message string.
 */
export class ProductAdminApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ProductAdminApiError';
    this.status = status;
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    return readApiErrorMessage(data, `Error ${res.status}`);
  } catch {
    return `Error ${res.status}`;
  }
}

async function throwApiError(res: Response): Promise<never> {
  throw new ProductAdminApiError(res.status, await parseErrorMessage(res));
}

export class ProductAdminService {
  /**
   * GET /api/products — public route (no apiAuthMiddleware, no csrfGuard on
   * the backend), so this read sends no credentials and no CSRF header. The
   * endpoint wraps its payload as `{ products: [...] }`; an absent key
   * yields an empty list rather than throwing.
   *
   * Returns the raw AdminProductDTO shape on purpose: the admin table needs
   * `stock`, `idCategory` and `idFranchise`, which the public-facing
   * `product.service.ts` drops when it adapts to the `Product` view model.
   *
   * Deliberately plain `fetch`, not `authFetch` (design.md D6, task 3.10):
   * a public read with no credentials can never 401, so there is nothing
   * for the retry wrapper to do here.
   */
  static async list(): Promise<AdminProductDTO[]> {
    const res = await fetch(`${API_URL}/api/products`);

    if (!res.ok) {
      return throwApiError(res);
    }

    const data = (await res.json()) as { products?: AdminProductDTO[] };
    return data?.products ?? [];
  }

  /**
   * GET /api/product/:id — public route, same no-credentials rationale as
   * `list`. A 404 surfaces as a ProductAdminApiError with that status so the
   * edit form can tell "no such product" from a transport failure.
   *
   * Deliberately plain `fetch`, not `authFetch` (design.md D6, task 3.10) —
   * same reason as `list`: a public, no-credentials read cannot 401.
   */
  static async getById(id: number): Promise<AdminProductDTO> {
    const res = await fetch(`${API_URL}/api/product/${id}`);

    if (!res.ok) {
      return throwApiError(res);
    }

    return (await res.json()) as AdminProductDTO;
  }

  /**
   * POST /api/products — ADMIN or STAFF. Multipart (image upload).
   * `stock` may be included in `formData` as the optional initial stock
   * (defaults to 0 server-side when omitted).
   */
  static async create(formData: FormData): Promise<AdminProductDTO> {
    const res = await authFetch(`${API_URL}/api/products`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      return throwApiError(res);
    }

    return (await res.json()) as AdminProductDTO;
  }

  /**
   * PUT /api/products/:id — ADMIN or STAFF. Multipart (optional replacement
   * image). MUST NOT be used to change stock — the backend ignores `stock`
   * on this endpoint entirely; use `adjustStock` instead.
   */
  static async update(id: number, formData: FormData): Promise<AdminProductDTO> {
    const res = await authFetch(`${API_URL}/api/products/${id}`, {
      method: 'PUT',
      body: formData,
    });

    if (!res.ok) {
      return throwApiError(res);
    }

    return (await res.json()) as AdminProductDTO;
  }

  /**
   * DELETE /api/products/:id — ADMIN only. Backend returns 403 for STAFF;
   * the UI hides this control for STAFF (visual-admin-hiding spec), but
   * that hiding is UX-only — this call still goes through the real guard.
   */
  static async remove(id: number): Promise<void> {
    const res = await authFetch(`${API_URL}/api/products/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      return throwApiError(res);
    }
  }

  /**
   * PATCH /api/products/:id/stock — ADMIN or STAFF. `delta` MUST be a
   * non-zero integer; the backend rejects zero/non-integer with 400 and a
   * delta that would take stock negative with 409.
   */
  static async adjustStock(id: number, delta: number): Promise<AdminProductDTO> {
    const res = await authFetch(`${API_URL}/api/products/${id}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ delta }),
    });

    if (!res.ok) {
      return throwApiError(res);
    }

    return (await res.json()) as AdminProductDTO;
  }
}
