// Mirrors backend/src/domain/Role.ts. Frontend and backend are separate
// packages (no cross-package import), so the values are duplicated here
// intentionally — keep them in sync if the backend enum ever changes.
export const Role = {
  ADMIN: 1,
  USER: 2,
  STAFF: 3,
} as const;

export type RoleValue = (typeof Role)[keyof typeof Role];

export interface APIUser {
  idUser: number;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  idRole: number;
}

export interface APILoginResponse {
  token: string;
  user: APIUser;
}

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  image: string;
  idRole: number;
}

export interface AuthData {
  token: string;
  user: User;
}

export const createAuthAdapter = (apiAuth: APILoginResponse): AuthData => {
  return {
    token: apiAuth.token,
    user: {
      id: apiAuth.user.idUser,
      firstName: apiAuth.user.firstName,
      lastName: apiAuth.user.lastName,
      email: apiAuth.user.email,
      image: apiAuth.user.image ?? '',
      idRole: apiAuth.user.idRole,
    },
  };
};

export const createUserAdapter = (apiUser: APIUser): User => {
  return {
    id: apiUser.idUser,
    firstName: apiUser.firstName,
    lastName: apiUser.lastName,
    email: apiUser.email,
    image: apiUser.image ?? '',
    idRole: apiUser.idRole,
  };
};
