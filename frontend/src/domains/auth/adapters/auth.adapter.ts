export interface APIUser {
  idUser: number;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
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
  };
};
