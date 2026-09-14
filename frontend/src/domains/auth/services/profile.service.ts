import { API_URL, authFetch, readApiErrorMessage } from '../../../config';

export interface ProfileUser {
  idUser: number;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  idRole: number | null;
  category: string | null;
}

export class ProfileServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProfileServiceError';
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isProfileUser(value: unknown): value is ProfileUser {
  if (typeof value !== 'object' || value === null) return false;

  const user = value as Record<string, unknown>;
  return (
    typeof user.idUser === 'number' &&
    typeof user.firstName === 'string' &&
    typeof user.lastName === 'string' &&
    typeof user.email === 'string' &&
    isNullableString(user.image) &&
    isNullableNumber(user.idRole) &&
    isNullableString(user.category)
  );
}

export async function fetchProfile(): Promise<ProfileUser> {
  const response = await authFetch(`${API_URL}/api/users/me`);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ProfileServiceError(
      response.status,
      readApiErrorMessage(body, 'No pudimos cargar tu perfil.'),
    );
  }

  const user =
    typeof body === 'object' && body !== null ? (body as { user?: unknown }).user : undefined;

  if (!isProfileUser(user)) {
    throw new ProfileServiceError(500, 'La respuesta del perfil no es válida.');
  }

  return user;
}
