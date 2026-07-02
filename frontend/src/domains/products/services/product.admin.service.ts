import { API_URL } from '../../../config';

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

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || data?.message || `Error ${res.status}`;
  } catch {
    return `Error ${res.status}`;
  }
}

export class ProductAdminService {
  /**
   * POST /api/products — ADMIN or STAFF. Multipart (image upload).
   * `stock` may be included in `formData` as the optional initial stock
   * (defaults to 0 server-side when omitted).
   */
  static async create(formData: FormData): Promise<AdminProductDTO> {
    const res = await fetch(`${API_URL}/api/products`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res));
    }

    return res.json();
  }

  /**
   * PUT /api/products/:id — ADMIN or STAFF. Multipart (optional replacement
   * image). MUST NOT be used to change stock — the backend ignores `stock`
   * on this endpoint entirely; use `adjustStock` instead.
   */
  static async update(id: number, formData: FormData): Promise<AdminProductDTO> {
    const res = await fetch(`${API_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders() },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res));
    }

    return res.json();
  }

  /**
   * DELETE /api/products/:id — ADMIN only. Backend returns 403 for STAFF;
   * the UI hides this control for STAFF (visual-admin-hiding spec), but
   * that hiding is UX-only — this call still goes through the real guard.
   */
  static async remove(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/api/products/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res));
    }
  }

  /**
   * PATCH /api/products/:id/stock — ADMIN or STAFF. `delta` MUST be a
   * non-zero integer; the backend rejects zero/non-integer with 400 and a
   * delta that would take stock negative with 409.
   */
  static async adjustStock(id: number, delta: number): Promise<AdminProductDTO> {
    const res = await fetch(`${API_URL}/api/products/${id}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ delta }),
    });

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res));
    }

    return res.json();
  }
}
